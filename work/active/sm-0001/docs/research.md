# Investigación técnica: sm-0001

> Generado por /design. Decisiones no triviales y su rationale.

## Decisión: Canal de entrega del evento de umbral (AC-1)

- **Contexto:** hoy `BudgetThresholdExceededEventHandler` solo hace `Logger.warn`. Hay que entregar el evento fuera del proceso, de forma confiable, sin perderlo ante una caída.
- **Opciones evaluadas:**
  1. `EventEmitter2` in-process (actual) — cero infra, pero se pierde si el proceso cae entre el commit y el handler; no cruza el límite del servicio.
  2. Broker externo (Redis/RabbitMQ/Kafka) — robusto, pero suma una dependencia de infraestructura que el repo no tiene y que para un proyecto personal es sobredimensionada.
  3. **Cola sobre PostgreSQL (postgresmq/PGMQ)** — confiable (persistida, transaccional con el cambio que la origina), reutiliza la única DB que ya existe, sin infra nueva.
- **Elegida:** cola sobre PostgreSQL — cubre la confiabilidad que pide AC-1 reutilizando Postgres; el consumidor externo (front/servicio de notificaciones) lee la cola.
- **Descartadas por:** EventEmitter2 no cruza el proceso ni sobrevive caídas; broker externo agrega infraestructura injustificada al tamaño actual.

## Decisión: Idempotencia "un umbral, una vez por período" (AC-1)

- **Contexto:** cada umbral (80%/100%) debe notificarse una sola vez por período del presupuesto. Hace falta recordar hasta qué umbral se notificó.
- **Opciones evaluadas:**
  1. **Columna en `budgets`** (`notified_threshold`: WARNING/EXCEEDED/null) — el budget ya representa "período vigente" (`active`); al renovar el período nace un budget nuevo con el estado limpio. Sin tabla ni joins.
  2. Tabla `budget_notifications` — más auditable/extensible, pero suma entidad y joins para un requisito hoy simple.
  3. Idempotency key en el consumidor de la cola — saca la garantía del productor; el backend deja de ser la fuente de verdad.
- **Elegida:** columna en `budgets` — ligada al ciclo de vida correcto (el período es el budget), mínima superficie. Enum-like como varchar (convención no-db-enums).
- **Descartadas por:** tabla nueva = complejidad sin caso de uso todavía; delegar al consumidor = pérdida de la garantía en el backend.

## Decisión: Moneda de presentación del balance consolidado (AC-2)

- **Contexto:** la preferencia de moneda vive en `users`. `finances` la necesita para consolidar cuentas de distinta moneda en `GET /summary/balance`.
- **Opciones evaluadas:**
  1. **Claim en el JWT** — `users` la agrega al token; `finances` la lee de `AuthenticatedUser`. Cero latencia, sin acoplar `finances` a un endpoint de `users`.
  2. HTTP GET a `users` vía `USERS_API_URL` — sin depender del token, pero suma un hop y manejo de caché/fallo en cada consolidación.
  3. Query param por request — sin estado, pero traslada la responsabilidad al front y puede variar entre pantallas.
- **Elegida:** claim en el JWT — coherente con que la autenticación ya es OIDC y `finances` ya consume `AuthenticatedUser`.
- **Impacto cruzado:** `AuthenticatedUser` (`libs/shared/src/auth/authenticated-user.type.ts`) hoy es `{ id, name, lastName, email, auth0Id }` — hay que **agregarle `presentationCurrency`**, y `users` debe emitir ese claim. Es un cambio en `@shared` + `users`, fuera del código de dominio de `finances`.
- **Descartadas por:** HTTP a users = latencia y acoplamiento en el hot path; query param = responsabilidad mal ubicada.

## Decisión: Montos en transferencia cross-currency (AC-2)

- **Contexto:** al transferir entre cuentas de distinta moneda, la pata origen y la destino tienen montos distintos.
- **Opciones evaluadas:**
  1. **Un monto (origen) + tasa del sistema** — el usuario indica el monto en la moneda origen; el sistema convierte con la tasa de `exchanges` a la fecha y calcula el monto destino.
  2. Ambos montos explícitos — refleja el movimiento bancario real, pero exige que el front pida ambos y valida menos.
- **Elegida:** un monto + tasa — mantiene `TransferInputDto` sin cambios (ya tiene un solo `amount`/`currency`), consistente con la tasa oficial. El `TransferOutputDto` gana `toAmount`, `toCurrency`, `exchangeRate`.
- **Descartadas por:** ambos montos explícitos complican el input y la validación para un caso menos común.

## Decisión: Reversa como compensación, no borrado (AC-5, AC-6)

- **Contexto:** anular una transferencia o revertir un movimiento de webhook mal reconciliado.
- **Elegida:** crear movimiento(s) compensatorio(s) que anulan el efecto, preservando el historial — práctica contable estándar, auditable. Ya fijado en `/clarify`; se registra aquí por su impacto en el diseño (nuevos usecases + `findByTransferGroup`).
- **Descartada:** soft-delete de las patas/movimiento — pierde el rastro de que hubo una operación anulada.
