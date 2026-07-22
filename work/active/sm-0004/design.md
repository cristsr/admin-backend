# design: sm-0004

> Generado por /design. Input para /plan.
> Investigación técnica: `docs/research.md`.
> Diagrama completo: `docs/diagram.md`. Contrato completo: `docs/api.yaml`.
> Sin modelado de datos nuevo (el trace id viaja en el payload jsonb del outbox existente).
> Revisá todo antes de ejecutar `/plan sm-0004`.

## Flujo entre microservicios

Historia no-funcional transversal sobre `apps/finances` (la auth vive en `libs/shared`).
Dos flujos con forma de secuencia (ver `docs/diagram.md`): (1) el `correlationId` que cruza
desde el webhook, atraviesa el outbox y llega al evento `BudgetThresholdExceeded`, todo
logueado estructurado con el mismo id (AC-4); y (2) el readiness que chequea DB + OIDC y
responde 200/503 (AC-2). El resto de los ACs son cross-cutting sin flujo HTTP propio.

## Alcance por criterio

### AC-1 — Contrato OpenAPI/Swagger

- Cablear `SwaggerModule` en `main.ts`, montando la UI **solo cuando `SHOW_DOCS` es true**
  (el flag ya existe validado en `env.ts`; false en producción). El documento OpenAPI se
  genera siempre; la UI navegable no.
- Declarar los esquemas de seguridad `bearerAuth` (JWT) y `webhookApiKey` (x-api-key) vía
  `DocumentBuilder`, y anotar cada controlador con `@ApiBearerAuth()` / `@ApiSecurity()` /
  sin seguridad (taxonomía y health) — ver notas de aplicación en `docs/api.yaml`.

### AC-2 — Health checks

- Instalar `@nestjs/terminus`. Nuevo `HealthController` con `GET /health/live` y
  `GET /health/ready`, ambos `@Public()`.
- Liveness: sin indicadores (solo confirma proceso vivo). Readiness: `TypeOrmHealthIndicator`
  (DB) + `OidcHealthIndicator` custom (reutiliza el resolver perezoso de AC-3). 200 sano /
  503 con detalle por dependencia (formato estándar de Terminus).
- Reemplaza el actual `GET /health` de `config/controllers/app.controller.ts` (que hoy queda
  detrás del guard JWT global — ver gap del scan).

### AC-3 — Discovery OIDC perezoso + cache

- En `libs/shared/src/auth/`: mover `discoverJwksUri` fuera del factory eager de
  `AuthModule.build()` a un resolver perezoso cacheado con TTL, disparado en la primera
  validación de token (espeja el patrón `jwks-rsa`). Ver `docs/research.md`.

### AC-4 — Logging estructurado + trace id + métricas

- Cablear `nestjs-pino` (ya instalado) como logger de la app en `main.ts`/`AppModule`, con
  `genReqId` que toma `X-Request-Id` entrante o genera el `correlationId`.
- Propagar `correlationId` dentro del payload jsonb del outbox para que sobreviva el salto
  request → cron del relay; el relay y los event handlers de budget lo restauran en el log.
- Crons y usecases emiten conteos estructurados (`scheduledMaterialized`, `budgetsGenerated`)
  — sin `/metrics`. Ver `docs/research.md`.

### AC-5 — Rate limiting

- Instalar `@nestjs/throttler` (storage en memoria — ver `docs/research.md`). `app.set('trust
proxy', ...)` en `main.ts` para leer la IP real de `X-Forwarded-For`.
- Auth 5/min y webhook 60/min por IP (webhook además por API key). Respuesta 429 con
  `Retry-After` (ver `docs/api.yaml`, componente `TooManyRequests`).

### AC-6 — e2e de auth contra Keycloak

- Agregar servicio Keycloak al `docker-compose.yml`. Nuevo test `*.e2e-spec.ts` que arranca
  la app contra ese IdP: un token válido pasa el guard, uno inválido es rechazado.
- Configurar Jest para e2e y sumar un job/step en `.github/workflows/ci.yml` que levante
  Keycloak y corra el e2e.

## Contratos por microservicio

### apps/finances

| Método | Ruta          | Descripción de negocio                                               |
| ------ | ------------- | -------------------------------------------------------------------- |
| GET    | /health/live  | Liveness: el proceso está vivo, sin tocar dependencias. Público.     |
| GET    | /health/ready | Readiness: DB + OIDC accesibles (200) o alguna caída (503). Público. |

Endpoints existentes que la historia **no cambia en shape** pero sí anota/protege:
webhook (`POST /webhooks/*`) suma rate limit + 429 y esquema `webhookApiKey`; los endpoints
privados declaran `bearerAuth`; el flujo de auth suma rate limit + 429.

> Schemas de request/response, esquemas de seguridad y el 429 completos: `docs/api.yaml`
> (tag `finances-health` + `components`).

## Validación de Quality Gates

Sin constitución en el repo — se aplican los cuatro gates built-in por defecto. Ejecutar
`/constitution` los haría exigibles project-wide.

| Gate              | Resultado | Justificación                                                                                                                                                                                      |
| ----------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simplicity        | ✅        | Rate limiter en memoria y trace id en el payload jsonb existente; sin Redis ni tablas nuevas ni stack de observabilidad (todo descartado por YAGNI en `research.md`).                              |
| Anti-Abstraction  | ✅        | Se usan los módulos oficiales directos (`@nestjs/terminus`, `@nestjs/throttler`, `@nestjs/swagger`, `nestjs-pino`) sin wrappers; el discovery perezoso reutiliza el patrón `jwks-rsa` ya presente. |
| Integration-First | ✅        | `docs/api.yaml` define health y esquemas de seguridad antes del código; AC-6 agrega un e2e real contra Keycloak que es en sí un contract test del flujo de auth.                                   |
| Test-First        | ✅        | `/plan` escribirá los specs (health indicators, throttler, resolver perezoso, e2e de auth) antes del código de implementación.                                                                     |
