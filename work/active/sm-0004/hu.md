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

[NEEDS CLARIFICATION: ¿la UI de Swagger se expone en todos los entornos o solo fuera de producción?]
[NEEDS CLARIFICATION: ¿el endpoint de la taxonomía pública y el webhook (API key) deben aparecer documentados y marcados con su esquema de auth?]

### AC-2: Health checks y readiness

No hay endpoint de salud. Antes de meter NGINX y orquestación, el servicio debe reportar su
estado y el de sus dependencias.

- El servicio expone un endpoint de salud que reporta el estado de la base de datos.
- El endpoint reporta el estado del proveedor OIDC (readiness).
- El endpoint de salud es público (no requiere JWT).

[NEEDS CLARIFICATION: ¿se distingue liveness (proceso vivo) de readiness (dependencias listas) en endpoints separados?]

### AC-3: OIDC discovery perezoso

El descubrimiento OIDC es *eager* al arrancar: si el IdP no responde, la app no levanta. Debe
volverse perezoso, como ya hace `jwks-rsa` con las llaves de firma.

- La app arranca aunque el proveedor OIDC no esté disponible en ese instante.
- El documento de descubrimiento se resuelve en el primer uso y se cachea.

[NEEDS CLARIFICATION: ¿el resultado del discovery se cachea con TTL/refresh, o se resuelve una sola vez y se mantiene mientras viva el proceso?]

### AC-4: Observabilidad — logging estructurado, trazas y métricas

Debe poder seguirse una operación de punta a punta y medir el trabajo de los crons.

- Los logs son estructurados y llevan un identificador de traza que cruza desde el webhook
  hasta el evento de presupuesto que dispara.
- Se exponen métricas de los crons (cuántos `scheduled`/`budgets` se materializaron por corrida).

[NEEDS CLARIFICATION: ¿el formato de métricas es Prometheus u otro? ¿Hay ya un stack de observabilidad al que integrarse?]
[NEEDS CLARIFICATION: ¿el trace id se genera en el borde (NGINX) y se propaga, o lo genera el servicio?]

### AC-5: Rate limiting en endpoints sensibles

`/webhooks` es público protegido solo por API key, y auth es un objetivo de fuerza bruta. El
servicio debe limitar la tasa de requests en esos endpoints.

- Los endpoints de webhook y de autenticación aplican límite de tasa.
- Al superar el límite, el servicio responde con el código de "demasiadas solicitudes".

[NEEDS CLARIFICATION: ¿cuáles son los límites (requests por ventana) por tipo de endpoint?]
[NEEDS CLARIFICATION: ¿el límite es por IP, por API key, por usuario, o combinación? (detrás de NGINX la IP real llega por header)]

### AC-6: Tests e2e del camino feliz de autenticación

El happy path de auth nunca se probó end-to-end (el WAF de Auth0 bloqueó la verificación).
Debe existir una prueba automatizada contra un IdP real de laboratorio.

- Existe un IdP de prueba (p. ej. Keycloak en `docker-compose`) contra el cual corre un test e2e.
- El test verifica que un token válido pasa el guard y uno inválido es rechazado.
- El test corre en CI.

[NEEDS CLARIFICATION: ¿se agrega Keycloak al `docker-compose` existente, o el IdP de prueba vive solo en el entorno de CI?]

## Reglas de Negocio

- El webhook se autentica con API key propia, no con JWT de usuario.
- La taxonomía de categorías y el health check son públicos; el resto de endpoints requiere JWT.

## Fuera de Alcance

- Reparar `apps/exchanges` y los tests rotos de `users` (deuda preexistente) — se listan como
  limitaciones en `RESUMEN_EJECUTIVO.md` y no forman parte de esta historia salvo en lo que
  impida el CI verde requerido por AC-6.
- La configuración de NGINX/reverse-proxy en sí (infraestructura, fuera de este repo).
