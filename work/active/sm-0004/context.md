# context: sm-0004

> Generado por /scan. Input para /design y /plan.
> No editar manualmente — re-ejecutar /scan si el contexto cambió.

## Historia resumida

**Como** operador/mantenedor del backend de finanzas
**Quiero** contrato de API publicado, health checks, observabilidad, discovery OIDC perezoso y protección de endpoints
**Para** poder poner el servicio en producción detrás de NGINX con confianza y diagnosticar fallos rápido

Historia **no-funcional transversal** (Grupo D): no toca un módulo de dominio, sino
puntos de integración a lo ancho de la app (bootstrap, auth compartida, webhook, crons,
CI). Por eso el contexto se organiza por AC/preocupación en vez de por entidad.

## Microservicios afectados

- `apps/finances` (app única; confirmado en clarify Q1). La auth vive en la lib compartida
  `libs/shared/src/auth/`, así que AC-3 toca también esa lib.

> Nota: `RESUMEN_EJECUTIVO.md` §2 quedó desactualizado — describe `finances`/`users` como
> microservicios separados, pero el fold ya ocurrió (`user`/`exchange` son módulos dentro de
> `apps/finances`). CLAUDE.md y el código actual mandan.

---

## apps/finances — anclajes por criterio

### Bootstrap de la app
**Archivo:** `D:\Cristian\Nest\admin-back\apps\finances\src\main.ts`
Arranque mínimo. Hoy tiene: `NestFactory.create(AppModule)`, `ValidationPipe` global
(`transform: true, forbidUnknownValues: false`), `useContainer(...)`, `app.listen(port)`,
`Logger.log(...)`. **No tiene** `SwaggerModule.setup(...)`, `app.set('trust proxy', ...)`,
ni `app.useLogger(...)`. Punto de enganche para AC-1 (Swagger), AC-4 (logger pino) y AC-5
(trust proxy).

### Módulo raíz
**Archivo:** `D:\Cristian\Nest\admin-back\apps\finances\src\app.module.ts`
**Imports actuales:** `ConfigModule.forRoot({ isGlobal: true, validate: validatorFactory(Environment) })`,
`CacheModule.register()`, `ScheduleModule.forRoot()`, `EventEmitterModule.forRoot({})`,
`DatabaseModule`, `AuthModule.forRootAsync(...)`.
**Providers explícitos:** solo `{ provide: APP_FILTER, useClass: ExceptionFilter }`.
No hay `ThrottlerModule`, `TerminusModule` ni `LoggerModule` (pino) en ningún lado del repo.
El `APP_GUARD` (JWT global) lo registra internamente `AuthModule.build()`, no este módulo.

### AC-1 — Contrato OpenAPI/Swagger
- `@nestjs/swagger` **ya instalado** (`^7.3.1`) pero **sin usar**: no hay `SwaggerModule` /
  `DocumentBuilder` en el repo, ni decoradores `@ApiTags`/`@ApiBearerAuth`/`@ApiSecurity`.
- Flag de entorno ya previsto: `SHOW_DOCS: boolean` existe en `env.ts` (validado) pero **no
  está cableado** — encaja directo con "UI solo fuera de producción".
- Guards de auth a documentar en el contrato: JWT global (`JwtAuthGuard`), API key
  (`WebhookApiKeyGuard`), públicos (`@Public()`: taxonomía y health).

### AC-2 — Health checks (liveness/readiness)
**Archivo actual:** `D:\Cristian\Nest\admin-back\apps\finances\src\config\controllers\app.controller.ts`
```ts
@Controller()
export class AppController {
  @Get('health')
  health() { this.logger.log('Health check success'); return { status: 'ok' }; }
}
```
- Un solo `GET /health`, **sin `@Public()`** → hoy queda detrás del guard JWT global (bug
  frente al AC-2, que lo exige público).
- No hay separación liveness/readiness, ni chequeo de DB/OIDC, ni `@nestjs/terminus`
  (**falta instalar**).

### AC-3 — Discovery OIDC perezoso + cache
**Lib compartida:** `D:\Cristian\Nest\admin-back\libs\shared\src\auth\`
(`auth.module.ts`, `jwt-auth.guard.ts`, `jwt.strategy.ts`, `oidc-discovery.ts`,
`identity-resolver.ts`, `auth.constants.ts`, `index.ts`).
- **Eager confirmado**: `AuthModule.build()` resuelve el discovery dentro del factory de
  `JWT_STRATEGY_OPTIONS` (`auth.module.ts` ~líneas 38-42 y 60-70), durante el init del
  módulo, **antes** de `app.listen()`. Si el IdP no responde, la app no levanta.
  ```ts
  useFactory: async (...args) => {
    const options = await asyncOptions.useFactory(...args);
    return { issuer, audience, jwksUri: await discoverJwksUri(options.issuer) };
  },
  ```
- `discoverJwksUri(issuer)` en `oidc-discovery.ts`: usa `axios.get` directo (no
  `HttpService`), arma `${issuer}/.well-known/openid-configuration`, devuelve `jwks_uri`.
  **Sin cache ni TTL.**
- El JWKS en sí (`jwks-rsa` `^3.1.0`) ya tiene cache/rate-limit en `jwt.strategy.ts`
  (`passportJwtSecret({ cache: true, rateLimit: true, jwksRequestsPerMinute: 5 })`) — el
  patrón lazy+cache a replicar para el discovery.
- `CacheModule.register()` ya está importado en `AppModule` (disponible para el TTL).

### AC-4 — Logging estructurado + trace id + métricas de crons
- **Sin trace id/correlation id** en ningún punto (ni middleware, ni interceptor, ni en los
  payloads de eventos `MovementSavedPayload` / `BudgetThresholdExceededPayload`).
- `nestjs-pino` (`4.1.0`) + `pino-pretty` (`^11.2.1`) **ya instalados pero no cableados**
  (no hay `LoggerModule` ni `app.useLogger`). Todos los `Logger` son locales
  (`new Logger(ClassName.name)`): en `app.controller.ts`, `pgmq-budget-notification.publisher.ts`,
  `save-many-categories.usecase.ts`, `generate-budgets.usecase.ts`,
  `generate-scheduled-movements.usecase.ts`, `outbox-relay.scheduler.ts`.
- **Crons** (solo emiten evento, sin log ni conteo):
  - `D:\Cristian\Nest\admin-back\apps\finances\src\budget\infrastructure\adapters\schedulers\budget.scheduler.ts` — `@Cron(EVERY_1ST_DAY_OF_MONTH_AT_NOON)` → emite `GenerateBudgets`.
  - `D:\Cristian\Nest\admin-back\apps\finances\src\scheduled\infrastructure\adapters\schedulers\scheduled.scheduler.ts` — `@Cron(EVERY_MINUTE)` → emite `GenerateScheduledMovements`.
  - El conteo real vive en los usecases: `generate-scheduled-movements.usecase.ts` sí loguea
    `Generating ${due.length} scheduled movement(s)`; `generate-budgets.usecase.ts` loguea
    sin conteo. Ninguno usa campos estructurados.
- **Cadena de eventos para el trace id webhook → presupuesto:**
  - `movement.saved` emitido en `apps\finances\src\movement\application\usecases\save-movement.usecase.ts` (vía outbox; constante `MovementSaved` en `movement\application\movement.constants.ts`).
  - Consumido por `apps\finances\src\budget\infrastructure\adapters\events\movement-saved.event-handler.ts`, que re-emite `BudgetThresholdExceeded` (constante en `budget\application\budget.constants.ts`).
  - Consumido por `apps\finances\src\budget\infrastructure\adapters\events\budget-threshold-exceeded.event-handler.ts` → `BudgetNotificationPublisher` → PGMQ (`pgmq-budget-notification.publisher.ts`).
  - Relay del outbox: `apps\finances\src\outbox\infrastructure\adapters\schedulers\outbox-relay.scheduler.ts` (`@Cron(EVERY_10_SECONDS)`). **Ningún event handler loguea hoy**, y los payloads no llevan correlation id.

### AC-5 — Rate limiting
- `@nestjs/throttler` **falta instalar**. Ningún guard de throttling en el repo.
- **Webhook:** `D:\Cristian\Nest\admin-back\apps\finances\src\webhook\infrastructure\adapters\http\webhook.controller.ts`
  — `@Controller('webhooks')` + `@Public()` + `@UseGuards(WebhookApiKeyGuard)`. Rutas:
  `POST /webhooks/transactions` y `POST /webhooks/transactions/:externalReference/reversal`.
  Guard en `...\webhook\infrastructure\adapters\http\webhook-api-key.guard.ts` (lee
  `x-api-key`, compara contra `ConfigService.get('WEBHOOK_API_KEY')`). Sin límite de tasa hoy.
- **Auth:** el guard JWT es global (`APP_GUARD` vía `AuthModule.build()`); no hay un endpoint
  de login propio en finances (la validación de token pasa por `JwtStrategy`). El límite de
  auth 5/min aplica a las rutas protegidas por JWT / el flujo de validación.
- **Trust proxy:** no está seteado en `main.ts`; hay que agregar `app.set('trust proxy', ...)`
  para leer la IP real de `X-Forwarded-For` detrás de NGINX.

### AC-6 — e2e de auth contra Keycloak
- **docker-compose:** `D:\Cristian\Nest\admin-back\docker-compose.yml` — único servicio
  `postgres:16` (host `5433→5432`, cred `postgres/admin`, DB `finances`, init script
  `./docker/postgres/init-databases.sh`). **Sin Keycloak** → agregarlo aquí (decisión clarify).
- **CI:** `D:\Cristian\Nest\admin-back\.github\workflows\ci.yml` — job único `build-and-test`
  (checkout → setup-node 20 → `npm ci --legacy-peer-deps` → `nx build finances` → migración
  TypeORM → `nx test finances`), con service `postgres`. **Sin job e2e, sin Keycloak.**
- **Jest:** `D:\Cristian\Nest\admin-back\apps\finances\jest.config.ts` — `preset: '../../jest.preset.js'`
  (usa `testMatch` default `*.spec.ts`). No hay patrón/config para `*.e2e-spec.ts`, ni
  `globalSetup`, ni ningún `*.e2e-spec.ts` propio del repo todavía.

### Env vars / config
**Archivo:** `D:\Cristian\Nest\admin-back\apps\finances\src\env.ts`
Clase `Environment` (validada con `class-validator`; fail-fast real vía
`libs/shared/src/config/index.ts`, lanza `InvalidConfigurationException`). Campos relevantes:
`OIDC_ISSUER`, `OIDC_AUDIENCE`, `AUTH_IDENTITY_PROVIDER`, `USERS_API_URL`, `WEBHOOK_API_KEY`,
`SHOW_DOCS: boolean` (ya validado, aún sin cablear — reservado para AC-1).

### Documentación disponible
No hay `docs/services/<micro>/` en este repo. Documentación de referencia:
`D:\Cristian\Nest\admin-back\RESUMEN_EJECUTIVO.md` (visión, módulos, endpoints, migraciones;
§4 auth, §9 limitaciones conocidas — punto 5 documenta el bloqueo Auth0/WAF del AC-6) y
`CLAUDE.md` (convenciones).

---

## Dependencias — estado para esta historia

| Paquete | Estado |
|---|---|
| `@nestjs/swagger` `^7.3.1` | Instalado, **sin usar** (AC-1) |
| `nestjs-pino` `4.1.0` + `pino-pretty` `^11.2.1` | Instalados, **sin cablear** (AC-4) |
| `@nestjs/axios` `^3.0.2` | Instalado y en uso |
| `jwks-rsa` `^3.1.0` | Instalado y en uso (patrón lazy+cache de referencia, AC-3) |
| `@nestjs/cache-manager` `2.2.2` (+ `CacheModule` importado) | Disponible para el TTL del discovery (AC-3) |
| `@nestjs/terminus` | **Falta instalar** (AC-2) |
| `@nestjs/throttler` | **Falta instalar** (AC-5) |

Core NestJS: `@nestjs/common` `10.3.9`, `platform-express` `10.3.9`, `config` `3.2.2`,
`event-emitter` `2.0.4`, `schedule` `4.0.2`, `passport` `10.0.3`, `jwt` `10.2.0`,
`typeorm` `10.0.2`. (`@nestjs/core` no figura explícito en `dependencies` — hoisting
transitivo; verificar antes de fijar versión si hace falta.)

---

## Gaps detectados

- **`GET /health` protegido por JWT**: el endpoint actual no tiene `@Public()`, contradice el
  requisito de health público (AC-2). El diseño debe reemplazarlo/marcarlo público.
- **Discovery OIDC eager en la lib compartida** (`libs/shared/src/auth/auth.module.ts`):
  AC-3 obliga a tocar `libs/shared`, no solo `apps/finances`.
- **Sin correlation id en payloads de eventos**: para el trace id webhook → `BudgetThresholdExceeded`
  (AC-4) habrá que propagar el id a través del outbox y los payloads (`MovementSavedPayload`,
  `BudgetThresholdExceededPayload`), que hoy no lo llevan.
- **Event handlers sin logging**: `movement-saved.event-handler.ts` y
  `budget-threshold-exceeded.event-handler.ts` no loguean; el trazado de punta a punta exige
  instrumentarlos.
- **Sin infraestructura e2e**: no hay `*.e2e-spec.ts`, ni config Jest e2e, ni Keycloak en
  compose/CI — AC-6 arranca de cero en esos tres frentes.
- **Deuda preexistente que puede frenar el CI verde (AC-6)**: tests de `users` rotos y
  `apps/exchanges` huérfano/roto (ver `RESUMEN_EJECUTIVO.md` §9). Declarados fuera de alcance
  en la HU salvo en lo que impidan el CI verde.
- **`@nestjs/core` no explícito** en `package.json`: confirmar al instalar `terminus`/`throttler`
  para no arrastrar un mismatch de versión con `@nestjs/common` `10.3.9`.
