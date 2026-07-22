# research: sm-0004

> Decisiones técnicas no triviales evaluadas por /design. Input para /plan y para
> la validación de Quality Gates.

## Decisión: Storage del rate limiter (AC-5)

- **Contexto:** `@nestjs/throttler` necesita un backend para contar requests por ventana.
  El servicio se planea correr detrás de NGINX; el conteo por IP real llega vía
  `X-Forwarded-For`.
- **Opciones evaluadas:**
  1. **Storage en memoria** (default de `ThrottlerModule`) — cero infraestructura nueva,
     simple. Contra: el conteo es por instancia; si se escala horizontalmente, el límite
     efectivo se multiplica por el número de réplicas.
  2. **Storage compartido en Redis** (`@nest-lab/throttler-storage-redis`) — límite global
     correcto con múltiples réplicas. Contra: introduce Redis, que hoy **no existe en el
     stack** (la mensajería usa PGMQ sobre Postgres, no Redis).
- **Elegida:** Storage en memoria. En fase de desarrollo con instancia única, el conteo
  por proceso es correcto y suficiente; introducir Redis ahora viola el gate de Simplicity
  (YAGNI) por un requisito de escala que todavía no existe.
- **Descartada Redis por:** dependencia de infraestructura sin caso de uso presente. Se deja
  anotada como el camino de upgrade explícito cuando el servicio se escale horizontalmente
  (`ThrottlerModule.forRootAsync` permite cambiar el storage sin tocar los guards).

## Decisión: Discovery OIDC perezoso + cache (AC-3)

- **Contexto:** Hoy el discovery es _eager_: `AuthModule.build()` resuelve
  `discoverJwksUri(issuer)` dentro del factory de `JWT_STRATEGY_OPTIONS`, durante el init
  del módulo, antes de `app.listen()`. Si el IdP no responde, la app no levanta. El JWKS en
  sí ya es perezoso y cacheado vía `jwks-rsa` (`passportJwtSecret({ cache: true, ... })`);
  falta replicar ese patrón para el documento de discovery.
- **Opciones evaluadas:**
  1. **Resolver el `jwksUri` de forma perezosa dentro de la resolución del secret**, en el
     primer token que llega, cacheando el resultado con TTL — espeja exactamente lo que ya
     hace `jwks-rsa`. La estrategia se construye con un `secretOrKeyProvider`/función que
     resuelve (y cachea) el `jwks_uri` en la primera invocación.
  2. **Mantener eager pero envolver en try/catch** y reintentar en background — la app
     levanta pero el estado es confuso (arranca "a medias"); más código de reintentos.
- **Elegida:** Opción 1 — mover la resolución del discovery fuera del factory de arranque a
  una función cacheada con TTL, disparada en el primer uso. Consistente con el patrón
  `jwks-rsa` ya presente y con la Limitación conocida documentada en `RESUMEN_EJECUTIVO.md`
  §4/§9.
- **TTL:** por defecto configurable (p. ej. `OIDC_DISCOVERY_TTL_MS`, default 1h). El
  `CacheModule` ya está importado en `AppModule`, disponible como backend del cache; una
  alternativa igual de válida es un promise cacheado con timestamp en el propio resolver.
- **Descartada la opción 2 por:** deja la app en un estado ambiguo al arrancar y agrega
  lógica de reintentos que el patrón perezoso vuelve innecesaria.

## Decisión: Indicador de readiness para OIDC (AC-2)

- **Contexto:** El readiness debe reportar el estado del proveedor OIDC, pero AC-3 vuelve el
  discovery perezoso — no queremos re-introducir un chequeo eager que rompa el arranque.
- **Opciones evaluadas:**
  1. **Health indicator custom de Terminus que invoca el resolver perezoso de discovery**
     (con timeout corto): si resuelve/está cacheado → `up`; si el IdP no responde → `down`.
     De paso, el primer readiness "calienta" el cache del discovery.
  2. **Ping directo a `${issuer}/.well-known/openid-configuration`** en cada readiness —
     duplica la lógica de discovery y golpea al IdP en cada chequeo.
- **Elegida:** Opción 1 — un `HealthIndicator` que reutiliza el mismo resolver cacheado de
  AC-3, con un timeout acotado para no colgar el endpoint. DB se cubre con el
  `TypeOrmHealthIndicator` estándar de Terminus.
- **Descartada la opción 2 por:** duplica lógica y presiona al IdP innecesariamente.

## Decisión: Propagación del trace id de punta a punta (AC-4)

- **Contexto:** El trace id debe cruzar desde el webhook hasta el evento
  `BudgetThresholdExceeded`. El problema: en el medio hay un **outbox** — `movement.saved`
  se persiste como fila y lo re-emite un relay por cron en otro contexto de request, donde
  ya no existe el request original ni su header.
- **Opciones evaluadas:**
  1. **`nestjs-pino` con `genReqId`** que toma `X-Request-Id` entrante o genera uno, +
     propagar el `correlationId` **dentro del payload jsonb del outbox** (`OutboxEvent.payload`
     ya es `ObjectLiteral`/jsonb, sin migración). El relay y los event handlers leen ese
     campo y lo re-inyectan en el contexto de log.
  2. **OpenTelemetry** con context propagation y un exporter — trazado distribuido completo.
     Mucho más setup y un backend de trazas que la historia explícitamente deja fuera
     (AC-4 clarify: sin stack de observabilidad).
- **Elegida:** Opción 1. `nestjs-pino` ya está instalado (sin cablear); el `correlationId`
  viaja en el payload jsonb del outbox sin cambio de esquema, sobreviviendo el salto
  request → cron del relay. Cero infraestructura nueva.
- **Descartada OpenTelemetry por:** excede el alcance (sin stack de observabilidad en esta
  historia) y pesa demasiado para un servicio en fase de desarrollo.
- **Implicación para /plan:** los payloads de eventos (`MovementSavedPayload`,
  `BudgetThresholdExceededPayload`) y `OutboxEvent.create(...)` deben aceptar/portar un
  `correlationId` opcional; el relay lo restaura en el logger antes de despachar.

## Decisión: Métricas de crons como campos de log (AC-4)

- **Contexto:** AC-4 (clarify) descartó `/metrics` y un stack de observabilidad; las
  métricas de crons se emiten como campos dentro de los logs estructurados.
- **Elegida:** Cada corrida de cron loguea una línea estructurada con conteos
  (`scheduledMaterialized`, `budgetsGenerated`) más el `correlationId` de la corrida. No se
  agrega endpoint ni dependencia. `generate-scheduled-movements.usecase.ts` ya cuenta items;
  se extiende el mismo patrón a `generate-budgets.usecase.ts` y a los schedulers.
- **Descartada `/metrics` (Prometheus) por:** decisión explícita de clarify — sin stack al
  que integrarse en esta historia.
