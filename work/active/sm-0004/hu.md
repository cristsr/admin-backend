# sm-0004: Calidad de plataforma no-funcional

## Historia de Usuario

**Como** operador/mantenedor del backend de finanzas
**Quiero** contrato de API publicado, health checks, observabilidad y protección de endpoints
**Para** poder poner el servicio en producción detrás de NGINX con confianza y diagnosticar fallos rápido

> Contexto: agrupa las ideas del **Grupo D** de `LLUVIA_DE_IDEAS.md` — no-funcionales que hoy faltan.

## Criterios de Aceptación

### AC-1: Contrato OpenAPI/Swagger publicado

No hay contrato publicado; el consumidor Rust y el front infieren el shape de cada endpoint.
El servicio debe exponer un contrato OpenAPI generado desde el código.

- El servicio expone la especificación OpenAPI de todos sus endpoints.
- El contrato refleja los DTOs de input/output y los códigos de respuesta reales.
- La UI navegable de Swagger se monta solo fuera de producción (habilitada en dev/staging,
  deshabilitada en producción vía variable de entorno). El documento OpenAPI puede seguir
  generándose en todos los entornos.
- El contrato incluye todos los endpoints, y cada uno declara su esquema de seguridad:
  JWT (bearer) para los endpoints privados, API key para el webhook, y sin auth para la
  taxonomía pública y el health check.

### AC-2: Health checks y readiness

No hay endpoint de salud. Antes de meter NGINX y orquestación, el servicio debe reportar su
estado y el de sus dependencias.

- El servicio expone dos endpoints de salud separados: liveness (`/health/live`) y
  readiness (`/health/ready`), ambos públicos (no requieren JWT).
- Liveness responde 200 mientras el proceso esté vivo, sin tocar dependencias externas.
- Readiness chequea la base de datos y el proveedor OIDC: si todas las dependencias
  están sanas responde 200 con `{ status: "up", checks: { db, oidc } }`; si alguna está
  caída responde 503 (Service Unavailable) con el detalle de qué dependencia falló.

### AC-3: OIDC discovery perezoso

El descubrimiento OIDC es _eager_ al arrancar: si el IdP no responde, la app no levanta. Debe
volverse perezoso, como ya hace `jwks-rsa` con las llaves de firma.

- La app arranca aunque el proveedor OIDC no esté disponible en ese instante.
- El documento de descubrimiento se resuelve en el primer uso y se cachea con un TTL; al
  expirar se re-resuelve, de modo que una rotación de configuración del IdP se absorbe sin
  reiniciar el proceso (alineado con cómo `jwks-rsa` refresca las llaves de firma).

### AC-4: Observabilidad — logging estructurado, trazas y métricas

Debe poder seguirse una operación de punta a punta y medir el trabajo de los crons.

- Los logs son estructurados y llevan un identificador de traza que cruza desde el webhook
  hasta el evento de presupuesto que dispara.
- El trace id se toma de un header de correlación entrante (ej. `X-Request-Id`) cuando el
  borde (NGINX) lo provee, y se propaga por todo el flujo; si no viene, el servicio lo
  genera. Así siempre hay un id, con o sin proxy delante (tests, crons, llamadas internas).
- Las métricas de los crons (cuántos `scheduled`/`budgets` se materializaron por corrida)
  se emiten como campos dentro de los logs estructurados de cada corrida. No hay endpoint
  `/metrics` ni stack de observabilidad en esta historia.

### AC-5: Rate limiting en endpoints sensibles

`/webhooks` es público protegido solo por API key, y auth es un objetivo de fuerza bruta. El
servicio debe limitar la tasa de requests en esos endpoints.

- Los endpoints de autenticación aplican un límite de 5 requests/minuto; el webhook, de
  60 requests/minuto. Los valores son conservadores y ajustables por configuración.
- El límite de auth se cuenta por IP real del cliente, extraída del header de forwarding
  que inyecta NGINX (`X-Forwarded-For`, con trust proxy configurado). El webhook se limita
  además por su API key.
- Al superar el límite, el servicio responde con código 429 (Too Many Requests).

### AC-6: Tests e2e del camino feliz de autenticación

El happy path de auth nunca se probó end-to-end (el WAF de Auth0 bloqueó la verificación).
Debe existir una prueba automatizada contra un IdP real de laboratorio.

- Se agrega Keycloak como servicio al `docker-compose` existente del repo, y el test e2e
  corre contra esa misma definición tanto en local como en CI (sin divergencia de entornos,
  el dev puede reproducir el fallo en su máquina).
- El test verifica que un token válido pasa el guard y uno inválido es rechazado.
- El test corre en CI.

## Resolución de Ambigüedades

- **AC-1:** ¿En qué entornos se expone la UI de Swagger? → Solo fuera de producción; el
  documento OpenAPI puede generarse en todos los entornos, la UI navegable se deshabilita
  en prod por variable de entorno.
- **AC-1:** ¿Se documentan taxonomía pública y webhook con su esquema de auth? → Sí, todos
  los endpoints en el contrato, cada uno con su seguridad declarada (JWT / API key / sin auth).
- **AC-2:** ¿Qué responde readiness ante una dependencia caída? → 200 sano / 503 con detalle
  por dependencia (`{ status, checks: { db, oidc } }`).
- **AC-2:** ¿Liveness y readiness separados? → Sí, `/health/live` (solo proceso) y
  `/health/ready` (chequea DB + OIDC), ambos públicos.
- **AC-3:** ¿Cómo se cachea el discovery OIDC? → Resolución perezosa en el primer uso,
  cacheada con TTL y re-resolución al expirar.
- **AC-4:** ¿Formato de métricas / stack existente? → Sin `/metrics` ni stack; las métricas
  de crons se emiten como campos dentro de los logs estructurados de cada corrida.
- **AC-4:** ¿Origen del trace id? → Se acepta del borde (`X-Request-Id`) si viene y se
  propaga; si no, lo genera el servicio.
- **AC-5:** ¿Límites por endpoint? → Auth 5/min, webhook 60/min, ajustables por config.
- **AC-5:** ¿Clave del límite? → Por IP real (`X-Forwarded-For` vía trust proxy) para auth;
  el webhook además por API key. Respuesta 429 al superarlo.
- **AC-6:** ¿Dónde vive el IdP de prueba? → Keycloak agregado al `docker-compose` existente,
  usado por el e2e tanto en local como en CI.

## Reglas de Negocio

- El webhook se autentica con API key propia, no con JWT de usuario.
- La taxonomía de categorías y el health check son públicos; el resto de endpoints requiere JWT.

## Fuera de Alcance

- Reparar `apps/exchanges` y los tests rotos de `users` (deuda preexistente) — se listan como
  limitaciones en `RESUMEN_EJECUTIVO.md` y no forman parte de esta historia salvo en lo que
  impida el CI verde requerido por AC-6.
- La configuración de NGINX/reverse-proxy en sí (infraestructura, fuera de este repo).

## Technical Context

### Microservicio objetivo

- apps/finances (toda la historia cae en esta app; incluye los módulos de auth/webhook,
  crons y el bootstrap de la aplicación)

### Patrones obligatorios

- Mantener el estándar de arquitectura hexagonal ya en uso en el repo (domain /
  application / infrastructure por módulo, puertos como `abstract class` para DI,
  DTOs en `application/dto/`).
- Incorporar las librerías del ecosistema NestJS que hoy faltan para cubrir los ACs:
  `@nestjs/swagger` (AC-1), `@nestjs/terminus` (AC-2), logger estructurado tipo
  `nestjs-pino` (AC-4) y `@nestjs/throttler` (AC-5).
