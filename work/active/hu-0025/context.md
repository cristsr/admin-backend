# context: hu-0025

## Historia resumida

**Como** cliente del ledger (frontend o automatizador)
**Quiero** previsualizar el efecto de un comando sin ejecutarlo (`dryRun`), y que los
deadlocks transitorios de PostgreSQL se reintenten solos (3 intentos, backoff exponencial
con jitter, `PERSISTENCE_CONFLICT` al agotar)
**Para** decidir con información real antes de escribir, y no recibir errores por carreras
de locks que el servidor puede reintentar en microsegundos

## Apps/libs afectadas

- `libs/cqrs` — command bus, policies, event store, dispatchers, interceptor HTTP
- `apps/ledger` — composition root, wiring Nest, controllers y DTOs de escritura

> **Nota de término:** lo que la historia llama «decoradores» (F-22) ya existe con el
> nombre **policies** (`CommandPolicy`). AC-1 no pide crear el mecanismo: pide que dry-run
> y retry entren bajo el que ya hay.

---

## libs/cqrs

### Módulo afectado
`D:\Cristian\Nest\admin-back\libs\cqrs\src\application\command-bus\`

### Punto de composición (AC-1 — ya existe)
**Archivo:** `D:\Cristian\Nest\admin-back\libs\cqrs\src\application\command-bus\command-policy.ts`
```typescript
export type CommandNext = (ctx: AuthContext) => Promise<CommandResult>;
export abstract class CommandPolicy {
  abstract handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult>;
}
```
**Archivo:** `D:\Cristian\Nest\admin-back\libs\cqrs\src\application\command-bus\command-bus.ts`
- `CommandBus` (abstracta): `dispatch(command: Command, ctx: AuthContext): Promise<CommandResult>`
- `PolicyCommandBus extends CommandBus`: `register(CommandCtor, CommandHandler)`,
  `registeredTypes()`, `dispatch()` — compone la cadena con `reduceRight` en **orden de
  registro** de las policies, handler al centro.
- `UnregisteredCommandException` (`UNREGISTERED_COMMAND`).

### Policies existentes (mecanismo al que se suman dry-run y retry)
| Policy | Archivo | Comportamiento |
|---|---|---|
| `AuthenticatedContextPolicy` | `policies\authenticated-context.policy.ts` | Rechaza si falta `userId`/`clientId` (`MissingAuthContextException`). |
| `IdempotencyPolicy` | `policies\idempotency.policy.ts` | Pre-check por `externalRef`; captura `DuplicateExternalRefException` → **relee el anchor y lo devuelve** (`requireAnchor` + `resolve` + `replay`). Compara `externalRefHash` y rechaza con `IDEMPOTENCY_INPUT_MISMATCH`. **AC-7 ya está implementado aquí (hu-0024)** — el diseño debe preservarlo. |
| `OptimisticConcurrencyPolicy` | `policies\optimistic-concurrency.policy.ts` | **`MAX_RETRIES = 1`: hoy SÍ reintenta una vez** un `ConcurrencyConflictException` antes de propagar. En tensión con AC-6 (ver Gaps). |

### Tipos base del bus
- `command.ts` — `abstract class Command { abstract readonly commandType: string }`
- `command-handler.ts` — `abstract class CommandHandler<TCommand> { execute(command, ctx): Promise<CommandResult> }`
- `command-result.type.ts` — `{ aggregateId: string; streamPosition: bigint; idempotentReplay: boolean }`
- `auth-context.type.ts` — `{ userId, clientId, externalRef, externalRefHash? }`; carrier
  contextual que ya enriquecen las policies (el hash llega al `EnvelopeFactory` así).
  Candidato natural para transportar el flag `dryRun` por la cadena (decisión de diseño
  vs. campo en cada `Command`).

### Event store (frontera transaccional — clave para AC-2 y AC-5)
**Puerto:** `D:\Cristian\Nest\admin-back\libs\cqrs\src\domain\ports\event-store.ts`
- `withTransaction<T>(work: () => Promise<T>): Promise<T>` (línea 50) — **no hay primitiva
  de rollback/dry-run**; hoy `withTransaction` siempre commitea si `work` resuelve.
- `append`, `load`, `readAll`, `findByExternalRef`.

**Adaptador Postgres:** `libs\cqrs\src\infrastructure\adapters\event-store\postgres\postgres-event-store.ts`
- `withTransaction` vía `AsyncLocalStorage<EntityManager>` (re-entrante: una llamada
  interna se une al scope externo).
- `translate()` (línea 204) mapea **solo** `23505` (unique violation) →
  `DuplicateExternalRefException` / `ConcurrencyConflictException`. **Los códigos `40P01`
  y `40001` no se traducen**: llegan como `QueryFailedError` crudo de TypeORM. El retry de
  AC-5 necesita un punto de detección tipado (traducir en el store vs. inspeccionar en la
  policy — decisión de diseño).
- Los appends se serializan por usuario con `pg_advisory_xact_lock(hashtext(userId))`.

**Adaptador in-memory:** `...\event-store\in-memory\in-memory-event-store.ts` —
`withTransaction` hace snapshot/restore (ver comentario en
`apps\ledger\src\bootstrap\ledger-application.spec.ts:103`).
**Contract tests:** `libs\cqrs\src\infrastructure\testing\event-store.contract.ts` — suite
`withTransaction — cross-stream atomicity` (línea 246) que corre idéntica contra ambos
adaptadores (RNF-11): cualquier primitiva nueva del puerto se cubre aquí.

### Proyecciones (AC-2/AC-3)
- `application\projection\projection-dispatcher.ts` — `ProjectionDispatcher` abstracta.
- `infrastructure\adapters\projection\synchronous-dispatcher.ts` — corre projectors inline
  sobre los eventos recién appendeados.
- `infrastructure\adapters\projection\polling-dispatcher.ts` — catch-up asíncrono desde
  checkpoint; el gap al head es el lag de proyección.
- **`infrastructure\adapters\read-model-store\postgres\postgres-read-model-store.ts` NO se
  une a la transacción del event store**: usa `dataSource.query` directo, sin consultar el
  `AsyncLocalStorage`. Los upserts de proyecciones síncronas quedan **fuera** de la
  transacción del comando hoy → un rollback de dry-run no los revertiría sin cambios
  (ver Gaps).
- Reactor (`§3.2`): `ReevaluateAssertionsReactor` lo conduce
  `apps\ledger\src\reconciliation\infrastructure\adapters\events\reconciliation.pump.ts`
  leyendo el **stream persistido** → si el dry-run no commitea, ningún reactor se dispara
  (AC-3 se satisface estructuralmente, sin flag especial).

### IdGenerator (AC-3)
- **Puerto:** `libs\cqrs\src\domain\ports\id-generator.ts` — `abstract next(): string`.
- **Contrato:** `libs\cqrs\src\testing\contract\id-generator.contract.ts` — exige forma
  **UUID v4** y unicidad. Adaptadores: `UuidIdGenerator` (infra),
  `SequentialIdGenerator` (testing).
- Al ser UUID v4 no hay secuencia de ids de dominio que «quemar»; lo que sí deja huecos en
  un rollback es `global_position` (BIGSERIAL) — tolerable para el catch-up (`>`), decisión
  de diseño si hace falta un generador descartable.

### Excepciones de dominio (AC-5/AC-6/AC-7)
**Archivo:** `libs\cqrs\src\domain\exceptions\event-store.exception.ts`
- `ConcurrencyConflictException` → `CONCURRENCY_CONFLICT`
- `DuplicateExternalRefException` → `DUPLICATE_EXTERNAL_REF`
- `IdempotencyInputMismatchException` → `IDEMPOTENCY_INPUT_MISMATCH`
- Todas extienden `DomainConflictException` (`libs\shared\src\exceptions\domain-conflict.exception.ts`, HTTP 409).
- **`PERSISTENCE_CONFLICT` no existe**: se crea aquí una excepción nueva con código estable.

### Respuesta HTTP de escrituras (AC-4)
**Archivo:** `libs\cqrs\src\infrastructure\adapters\http\command-result.interceptor.ts`
- `CommandResult` → `CommandAcceptedDto`; headers `X-Ledger-Stream-Position` siempre y
  `Idempotency-Hit: true` + downgrade a 200 en replay.
- Es el esquema de respuesta que el dry-run debe devolver idéntico.

### Tests de referencia
- `libs\cqrs\src\application\command-bus\command-bus.spec.ts`
- `libs\cqrs\src\application\command-bus\policies\*.spec.ts` (uno por policy)
- `libs\cqrs\src\infrastructure\adapters\http\command-result.interceptor.spec.ts`

---

## apps/ledger

### Módulo afectado
`D:\Cristian\Nest\admin-back\apps\ledger\src\bootstrap\` (composición) + controllers de escritura.

### Composition root (donde se registran las policies nuevas)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\bootstrap\ledger-application.factory.ts`
```typescript
const commandBus = new PolicyCommandBus([
  new AuthenticatedContextPolicy(),
  new IdempotencyPolicy(eventStore),
  new OptimisticConcurrencyPolicy(),
]);
```
- Registra 13 commands (accounts, ledger, transactions, reference).
- El orden del array define el orden de la cadena — el diseño decide dónde entran
  `DryRunPolicy` y `RetryPolicy` (p.ej. retry fuera para reintentar la cadena entera;
  dry-run dentro de idempotencia para que un preview no grabe el anchor).

### Wiring Nest
**Archivo:** `apps\ledger\src\bootstrap\ledger-core.module.ts` (`@Global`)
- Providers: `PolicyCommandBus` (factory con `EventStore, ReadModelStore, Clock,
  IdGenerator, CurrencyCatalog, ReadModelCurrencyCatalog`), alias `CommandBus`,
  `RegistryQueryBus` + alias `QueryBus`, `EventStore → PostgresEventStore`,
  `ReadModelStore → PostgresReadModelStore`, `IdGenerator → UuidIdGenerator`,
  `Clock → SystemClock`, read ports, etc.

### Endpoints de escritura (AC-4 — todos deben aceptar `dryRun` en el body)
Todos despachan por `CommandBus` con `@UseInterceptors(CommandResultInterceptor)` y
construyen el `AuthContext` a mano (`@Context()` + `@ExternalRef()`):

| Controller | Archivo | Writes |
|---|---|---|
| Accounts | `apps\ledger\src\accounts\infrastructure\adapters\http\accounts.controller.ts` | open, rename, opening-balance, close |
| Ledger | `apps\ledger\src\ledger\infrastructure\adapters\http\ledger.controller.ts` | initialize, replace-settings |
| Transactions | `apps\ledger\src\transactions\infrastructure\adapters\http\transactions.controller.ts` | record, confirm, amend, annotate, void, reverse |
| Transfer | `apps\ledger\src\transactions\infrastructure\adapters\http\transfer.controller.ts` | merge transfers |
| Currencies | `apps\ledger\src\reference\infrastructure\adapters\http\currencies.controller.ts` | register |
| Balance assertions | `apps\ledger\src\reconciliation\infrastructure\adapters\http\balance-assertion.controller.ts` | assert, revoke, resolve |

### DTOs existentes (donde va `dryRun: boolean`, default `false`)
Patrón: `<module>\infrastructure\adapters\http\dto\<use-case>-request.dto.ts` —
clases con `class-validator` + `@ApiProperty` (DTO_STYLE del perfil). 16 request DTOs,
p.ej. `RecordTransactionRequestDto`
(`apps\ledger\src\transactions\infrastructure\adapters\http\dto\record-transaction-request.dto.ts`).
Los commands se construyen campo a campo desde el DTO en el controller — `dryRun` debe
llegar del body al command o al `AuthContext` (decisión de diseño).

### Observabilidad (AC-8)
- `libs\shared\src\telemetry\telemetry.config.ts` — SDK OTel opt-in (trazas + métricas
  OTLP), importado en `apps\ledger\src\main.ts`. **No existe ningún puerto de métricas ni
  contador en el código**: las métricas de RNF-12 son backlog (`work\backlog\hu-0022`,
  roadmap línea 267). El contador de reintentos de AC-8 necesita un mecanismo mínimo
  (ver Gaps).

### Documentación disponible
- Spec: `D:\Cristian\Nest\admin-back\docs\ledger-spec.md` — RNF-11 (línea 483, aislamiento
  hexagonal), RNF-12 (línea 484, OTel; nombra lag de proyecciones, conflictos de
  concurrencia, errores de projectors/reactors).
- Propuesta origen: `docs\proposals\formance-ledger-ideas.md` — F-12 dry-run (L518-551),
  F-14 retry (L610-656), F-22 decoradores (L880-902).
- Docs vivos del módulo a reconciliar en `/sync`:
  `apps\ledger\docs\shared\flows\command-dispatch.md`, `idempotent-write.md`,
  `map-domain-error.md`.
- Decisiones acumuladas: `docs\decisions.md`.

---

## Gaps detectados

1. **AC-6 vs. implementación actual.** `OptimisticConcurrencyPolicy` reintenta hoy
   `CONCURRENCY_CONFLICT` **una vez** (`MAX_RETRIES = 1`) antes de propagar. AC-6 dice que
   «no entra en el reintento automático» y «se sigue propagando al cliente **como hoy**».
   `/design` debe resolver: ¿se mantiene el retry-once actual, se elimina, o AC-6 solo
   prohíbe que la **nueva** retry policy lo capture? (El raciocinio del hu —«premisas
   viejas»— contradice parcialmente el del código —«re-run recarga el agregado contra el
   head fresco»—.)
2. **`40P01`/`40001` no tipados.** `PostgresEventStore.translate()` solo mapea `23505`. El
   retry necesita detectarlos: traducirlos a una excepción de dominio en el adaptador
   (consistente con lo existente) vs. inspeccionar `QueryFailedError` en la policy.
3. **Rollback no cubre proyecciones síncronas.** `PostgresReadModelStore` escribe fuera de
   la transacción del comando (no consulta el `AsyncLocalStorage` del event store). AC-2
   exige «proyecciones síncronas dentro de la transacción + rollback»: hay que unir el
   read-model store al scope transaccional o revertirlas aparte.
4. **El puerto `EventStore` no tiene primitiva de rollback.** `withTransaction` siempre
   commitea al resolver. Dry-run necesita una variante (p.ej. `withTransaction` con modo,
   o un mecanismo de abort silencioso) implementable en ambos adaptadores y cubierta por
   el contract test (RNF-11).
5. **Sin infraestructura de métricas.** RNF-12 está en backlog (hu-0022, sin disparo
   cumplido). AC-8 exige un contador por tipo de comando: decidir un mecanismo mínimo
   (p.ej. meter OTel directo en la policy, o un puerto `Metrics` en el núcleo) sin
   arrastrar toda la hu-0022.
6. **Transporte de `dryRun`.** 16 request DTOs + 13+ commands: definir si viaja como campo
   del `Command` base (AC-2 dice «los commands aceptan un parámetro dryRun») o en el
   `AuthContext` (patrón ya usado para `externalRefHash`).
7. **Referencia rota (menor).** El hu enlaza la épica `work/ledger/EP-6-formance.md`, que
   no existe en el repo.
