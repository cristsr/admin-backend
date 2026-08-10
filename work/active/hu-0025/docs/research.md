# Research — hu-0025: Políticas transversales del command bus

Decisiones técnicas no triviales de la historia, con alternativas evaluadas y
rationale. Lo resuelto por preguntas al usuario está en `design.md` (Decisiones
de Diseño); acá vive el *por qué* de lo que el scan/contexto dejó abierto.

---

## Decisión: transporte del flag `dryRun` — AuthContext vs campo del Command

- **Contexto:** AC-2 dice "los commands aceptan un parámetro `dryRun`"; AC-4 lo
  fijó como campo del body. Internamente, ¿el flag viaja como campo del `Command`
  (13 constructores) o como metadata del `AuthContext` (patrón ya usado por
  `externalRef`/`externalRefHash`, que son parámetros de comando transportados en
  el ctx)?
- **Opciones evaluadas:**
  1. Campo del `Command` base (default `false`) — fiel a la letra de AC-2; pero
     los commands son clases planas con `readonly` por constructor: tocarlos es
     13 archivos, y cualquier lectura del flag por una policy tiene que conocer
     el comando concreto.
  2. `dryRun?: boolean` en `AuthContext` — el controller lo lee del body y lo
     pone en el ctx; `DryRunPolicy` lo lee del ctx. `IdempotencyPolicy.hashInputs`
     hashea `{ userId, command }`: si `dryRun` fuera campo del command entraría
     al hash, y un preview con `externalRef` produciría un hash distinto del de
     la corrida real con los mismos inputs → falso `IDEMPOTENCY_INPUT_MISMATCH`.
     En el ctx (metadata de transporte, como `externalRef`/`clientId`) queda
     **excluido del hash por construcción**, sin código defensivo.
- **Elegida:** 2 — `dryRun` en `AuthContext`. El hash de idempotencia es la razón
  decisiva: el flag es metadata de transporte, exactamente la categoría que la
  hu-0024 excluye del hash. La letra de AC-2 ("los commands aceptan un parámetro")
  se cumple a nivel de contrato (el body lo acepta); internamente lo transporta
  el ctx, como ya ocurre con `externalRef` (un parámetro de comando que las
  policies leen del ctx, no del command).
- **Descartadas por:** costo de tocar 13 commands + riesgo silencioso de
  contaminar el hash de idempotencia.

---

## Decisión: frontera transaccional del dry-run — rollback en el puerto EventStore

- **Contexto:** AC-2 exige "ejecutar completo dentro de la transacción + rollback".
  Hoy la frontera transaccional NO es del bus: cada handler que necesita
  atomicidad llama `EventStore.withTransaction` por su cuenta, y `withTransaction`
  siempre commitea al resolver. Sin una primitiva de rollback, el preview no
  existe.
- **Opciones evaluadas:**
  1. `DryRunPolicy` envuelve `next(ctx)` en `eventStore.withTransaction(work, { rollback: true })`
     (puerto ampliado). El `append` ya consulta el `AsyncLocalStorage` del scope,
     así que los appends del handler **se unen** a la transacción del preview sin
     tocar handlers (los `withTransaction` internos son re-entrantes y se unen al
     scope externo). Postgres: `QueryRunner` manual (begin → work → ROLLBACK →
     devolver resultado) en vez de `dataSource.transaction`; in-memory:
     snapshot/restore (mecanismo que ya tiene para su `withTransaction`, ahora
     también en éxito). Contract test: caso nuevo "rollback en éxito" que corre
     contra ambos adaptadores.
  2. Excepción centinela: ejecutar y luego lanzar un `RollbackSignal` que el
     adaptador atrapa para revertir. No requiere cambiar el puerto, pero convierte
     el flujo de control feliz en excepciones — código confuso y el resultado
     exitoso quedaría encerrado en el `catch`.
  3. Endpoint de validación aparte que reimplementa reglas. Descartado por la
     propia F-12: es la duplicación que garantiza divergencia.
- **Elegida:** 1 — primitiva explícita en el puerto. El preview ES la ejecución
  real (AC-2), solo que revertida: mismo código, misma frontera.
- **Descartadas por:** centinela = anti-patrón de flujo; validación duplicada =
  divergencia garantizada.
- **Efecto colateral necesario (Gap 3 del scan):** `PostgresReadModelStore`
  escribe hoy por `dataSource.query` directo, fuera del scope — el rollback no
  revertiría las proyecciones síncronas, violando AC-2/AC-3. Pasa a resolver sus
  escrituras a través del mismo `AsyncLocalStorage<EntityManager>` (scope
  compartido entre adaptadores). En in-memory, el read model store suma
  snapshot/restore bajo el mismo scope transaccional. Los upserts siguen siendo
  idempotentes por clave → sin riesgo de doble escritura en replays.

---

## Decisión: detección de errores transitorios — traducir en el adaptador

- **Contexto:** AC-5 fija los dos códigos (`40P01`, `40001`). Hoy
  `PostgresEventStore.translate()` solo traduce `23505` (unique violation); un
  deadlock llegaría al cliente como `QueryFailedError` crudo → 500 sin `code`.
- **Opciones evaluadas:**
  1. **Traducir en `PostgresEventStore.translate()`** → `TransientPersistenceException`
     (extiende `DomainException`, `libs/cqrs`). Consistente con el patrón existente
     (los `23505` ya se traducen acá, el único lugar que ve el driver), testeable
     por contract/unit sobre el adaptador, y la policy de reintento solo conoce
     tipos de dominio (Artículo 1).
  2. Inspeccionar `QueryFailedError.driverError.code` dentro de `RetryPolicy` —
     mete el detalle de driver en la capa de aplicación, viola el Artículo 1 y
     acopla la policy a TypeORM.
- **Elegida:** 1 — traducción en el adaptador.
- **Descartadas por:** Artículo 1 (núcleo aislado) y RNF-11.

---

## Decisión: posición del `RetryPolicy` en la cadena y relación con dry-run

- **Contexto:** la cadena se compone por orden de registro
  (`reduceRight`, array → de afuera hacia adentro). Hoy:
  `[Authenticated, Idempotency, OptimisticConcurrency]`.
- **Opciones evaluadas:**
  1. **`[Authenticated, Retry, Idempotency, OptimisticConcurrency, DryRun]`** —
     Retry envuelve a idempotencia (un reintento re-corre el pre-check
     `findByExternalRef`, que en un deadlock no encontró ancla) y DryRun queda
     adentro (su transacción envuelve solo el handler; los appends se unen al
     scope). Retry NO puede estar dentro de la transacción del dry-run: un error
     deja la transacción PG en estado aborted — reintentar dentro de la misma es
     fallar siempre.
  2. `[Authenticated, Idempotency, OptimisticConcurrency, Retry, DryRun]` — Retry
     adentro de idempotencia: no re-corre el pre-check y re-intenta solo el
     handler; el caso de un fallo transitorio DURANTE el pre-check (raro) quedaría
     sin reintentar.
- **Elegida:** 1 — Retry segundo (fuera de idempotencia y de la transacción del
  dry-run); DryRun último (más interno).
- **Descartadas por:** transacciones aborted y pre-check fuera del reintento.
- **AC-6 verificado:** `OptimisticConcurrencyPolicy` (retry-once actual con reload
  del agregado) queda intacta — la decisión del usuario en PHASE 3. RetryPolicy
  solo captura `TransientPersistenceException`; `ConcurrencyConflictException` y
  `DuplicateExternalRefException` son clases distintas y propagan a sus políticas.

---

## Decisión: métrica de reintentos (AC-8) — puerto mínimo + adapter OTel ya

- **Contexto:** no existe infraestructura de métricas (RNF-12 en backlog hu-0022);
  el SDK OTel está configurado (`libs/shared/src/telemetry/telemetry.config.ts`)
  pero sin meters ni counters en el código. AC-8 exige un contador por tipo de
  comando observable ahora.
- **Opciones evaluadas:**
  1. **Puerto `RetryCounter` (application) + adapter `OtelRetryCounter`
     (infra, `@opentelemetry/api`)**, cableado en `ledger-core.module.ts`. El
     núcleo no conoce OTel (Artículo 1); la cuarta métrica de RNF-12 se suma sin
     arrastrar hu-0022 (las otras tres siguen en backlog).
  2. Solo puerto + no-op hasta hu-0022 — AC-8 cumplido "en papel", métrica no
     observable.
  3. OTel directo en la policy — viola Artículo 1/RNF-11.
- **Elegida:** 1 — puerto mínimo + adapter real ya.
- **Descartadas por:** AC-8 exige observabilidad real; OTel en el núcleo viola la
  constitución.

---

## Decisión: ids en dry-run (AC-3) — nada que quemar

- **Contexto:** AC-3 pide un `IdGenerator` determinista o descartable para no
  "quemar" ids. El `EnvelopeFactory` usa `IdGenerator` (port) con `UuidIdGenerator`
  (UUID v4) en producción.
- **Evaluación:** UUID v4 no es secuencial: no hay secuencia de ids de dominio que
  consumir ni saltar. La única secuencia real es `global_position`
  (BIGINT GENERATED ALWAYS AS IDENTITY): un rollback consume valores y deja
  huecos, pero el catch-up de proyecciones compara `global_position > from` y los
  huecos son inocuos.
- **Elegida:** sin cambio de código — se documenta en el flow `dry-run-preview.md`
  que el requisito se satisface por construcción (AC-3).
- **Descartadas por:** un generador determinista para producción introduciría
  riesgo de colisión de `event_id` (UNIQUE) sin beneficio.
