# context: hu-0008

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** un `ProjectionRebuilder` mejorado que reconstruya cualquier proyección desde cero por replay del stream, y un `ConsistencyVerifier` que compare los saldos derivados del stream contra `proj_balances`
**Para** tener la garantía operativa de que el núcleo es reconstruible y auditable (RNF-5), cerrando EP-1 con la certeza de que el stream y las proyecciones son consistentes

## Componentes afectados

- `apps/ledger`

---

## apps/ledger

### Módulo afectado — `shared-kernel` (proyecciones + tooling de rebuild)

**Path:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\`

Este módulo contiene las abstracciones de proyección (puertos, dispatchers, proyector base) y los adaptadores de infraestructura. La historia extiende el `ProjectionRebuilder` existente y agrega un `ConsistencyVerifier`.

### Estructura hexagonal del módulo

```
shared-kernel/
  domain/
    ports/event-store.ts                    ← EventStore (abstract)
    event/stored-event.type.ts              ← StoredEvent = EventEnvelope & { globalPosition: bigint }
    event/event-envelope.type.ts            ← EventEnvelope
    event/stream-id.type.ts                 ← StreamId
  application/
    projection/
      projector.ts                          ← Projector (abstract)
      projection-dispatcher.ts              ← ProjectionDispatcher (abstract)
      projection-checkpoint.repository.ts   ← ProjectionCheckpointRepository (abstract)
      read-model-store.ts                   ← ReadModelStore (abstract)
    event/event-registry.ts                 ← EventRegistry (abstract)
    event-sourced.repository.ts             ← EventSourcedRepository<TAggregate> (abstract)
  infrastructure/adapters/
    projection/
      projection-rebuilder.ts               ← ProjectionRebuilder ✅ (existe desde hu-0004)
      synchronous-dispatcher.ts             ← SynchronousProjectionDispatcher
      polling-dispatcher.ts                 ← PollingProjectionDispatcher
      in-memory-projection-checkpoint.repository.ts
    event-store/
      postgres/postgres-event-store.ts      ← PostgresEventStore
      in-memory/in-memory-event-store.ts    ← InMemoryEventStore
    read-model-store/
      postgres/postgres-read-model-store.ts ← PostgresReadModelStore
      in-memory/in-memory-read-model-store.ts ← InMemoryReadModelStore
```

### Puertos relevantes para la historia

#### EventStore (puerto de solo lectura para esta historia)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\ports\event-store.ts`

**Métodos:**
- `readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>`
- `load(stream: StreamId): Promise<readonly StoredEvent[]>`
- `append(stream, expectedVersion, events): Promise<AppendResult>` — NO se usa en esta historia
- `findByExternalRef(userId, externalRef): Promise<Nullable<StoredEvent>>`

#### ReadModelStore

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\read-model-store.ts`

**Métodos:**
- `upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>`
- `delete(table: string, key: ReadModelKey): Promise<void>`
- `query<TRow>(table: string, criteria: Criteria): Promise<TRow[]>`
- `truncate(table: string): Promise<void>`

Tipos auxiliares:
- `ReadModelKey = Readonly<Record<string, string>>`
- `ReadModelRow = Readonly<Record<string, unknown>>`

#### ProjectionCheckpointRepository

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projection-checkpoint.repository.ts`

**Métodos:**
- `lastPosition(projectionName: string): Promise<bigint>`
- `advance(projectionName: string, position: bigint): Promise<void>`

#### Projector (abstracción de proyector)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projector.ts`

**Métodos:**
- `abstract readonly name: string`
- `abstract readonly consumes: readonly string[]`
- `abstract project(event: StoredEvent, store: ReadModelStore): Promise<void>`
- `handles(eventType: string): boolean`

#### ProjectionDispatcher

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projection-dispatcher.ts`

**Métodos:**
- `abstract dispatch(events: readonly StoredEvent[]): Promise<void>`

#### EventRegistry

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\event\event-registry.ts`

**Métodos:**
- `abstract register(eventType: string, deserializer: EventDeserializer): void`
- `abstract deserialize(eventType: string, schemaVersion: number, payload: EventPayload): DomainEvent`

### ProjectionRebuilder existente

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\projection\projection-rebuilder.ts`

**Constructor:**
```typescript
constructor(
  private readonly eventStore: EventStore,
  private readonly readModel: ReadModelStore,
  private readonly checkpoints: ProjectionCheckpointRepository,
) {}
```

**API actual:**
- `rebuild(target: RebuildTarget): Promise<number>` — trunca las tablas del target, resetea checkpoint, y hace replay completo vía `PollingProjectionDispatcher.catchUp()`
- `isCaughtUp(projectionName: string): Promise<boolean>` — compara el checkpoint con la última posición del stream

**Tipo auxiliar:**
```typescript
export type RebuildTarget = {
  readonly projectionName: string;
  readonly projectors: readonly Projector[];
  readonly tables: readonly string[];
};
```

**Falta para satisfacer los AC de hu-0008:**
- AC-3: `rebuildAll()` — no existe aún. Debe iterar sobre todas las proyecciones registradas y devolver un `RebuildReport` por cada una.
- AC-1/AC-4: `rebuild` actual usa `RebuildTarget` con arrays de projectors y tables. La HU pide `rebuild(projectionName)` — posible refactor para que reciba un registro/proyección por nombre en vez de un target explícito.

**Spec existente:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\projection\projection-rebuilder.spec.ts`

---

### Proyectores registrados (para `rebuildAll` y verificación)

Definidos en `createLedgerApplication()` (`D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\application\ledger-application.factory.ts:62-67`):

| Proyector | name | consumes | Tablas |
|-----------|------|----------|--------|
| `AccountTreeProjector` (`accounts/infrastructure/projections/`) | `'account_tree'` | `AccountOpened`, `AccountRenamed`, `AccountClosed` | `proj_accounts` |
| `TransactionListProjector` (`transactions/infrastructure/projections/`) | `'transaction_list'` | `TransactionRecorded`, `TransactionAmended`, `TransactionAnnotated`, `TransactionConfirmed`, `TransactionVoided`, `TransactionReversed` | `proj_transactions`, `proj_postings` |
| `AccountBalancesProjector` (`transactions/infrastructure/projections/`) | `'account_balances'` | `TransactionRecorded`, `TransactionAmended`, `TransactionConfirmed`, `TransactionVoided`, `TransactionReversed` | `proj_balances` |
| `LedgerSettingsProjector` (`ledger/infrastructure/projections/`) | `'ledger_settings'` | `LedgerInitialized` | `proj_ledger_settings` |

---

### Constantes de tablas de proyección

| Constante | Valor | Definida en |
|-----------|-------|-------------|
| `PROJ_ACCOUNTS` | `'proj_accounts'` | `accounts/infrastructure/projections/account-tree.projector.ts` |
| `PROJ_TRANSACTIONS` | `'proj_transactions'` | `transactions/infrastructure/projections/transaction-list.projector.ts` |
| `PROJ_POSTINGS` | `'proj_postings'` | `transactions/infrastructure/projections/transaction-list.projector.ts` |
| `PROJ_BALANCES` | `'proj_balances'` | `transactions/infrastructure/projections/account-balances.projector.ts` |
| `PROJ_LEDGER_SETTINGS` | `'proj_ledger_settings'` | `ledger/infrastructure/projections/ledger-settings.projector.ts` |

---

### Schema de `proj_balances` (relevante para ConsistencyVerifier)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\database\migrations\1790000000003-CreateCoreProjections.ts`

```sql
CREATE TABLE "proj_balances" (
  "account_id"       UUID NOT NULL,
  "currency_code"    TEXT NOT NULL,
  "confirmed_amount" NUMERIC(20, 6) NOT NULL DEFAULT 0,
  "pending_amount"   NUMERIC(20, 6) NOT NULL DEFAULT 0,
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("account_id", "currency_code")
)
```

---

### Money (comparación decimal exacta — INV-8)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\money\money.ts`

**Métodos relevantes para verificación:**
- `static of(amount: string, currency: Currency): Money` — construye desde string decimal, nunca desde number
- `equals(other: Money): boolean` — comparación exacta (usa `Big.eq`)
- `compareTo(other: Money): -1 | 0 | 1`
- `toDecimalString(): string` — para serializar a formato compatible con NUMERIC(20,6)

---

### CLI / infraestructura de comandos

**No existe.** No hay `nestjs-command`, `CommandRunner`, `@Command`, ni scripts Nx de consola en `apps/ledger`. La app solo tiene `main.ts` con `NestFactory.create`. El `project.json` solo define targets `build`, `serve`, `lint`, `test`.

**Gap:** La historia pide un adaptador driving tipo CLI (`nestjs-command` o script de Nx). Según las reglas de negocio, `application/` debe estar libre de NestJS/TypeORM; el comando CLI es la única pieza de infraestructura.

---

### Documentación disponible

- `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared-kernel\component.md` — diagrama C4 Nivel 3 del shared-kernel (command bus, query bus, proyecciones)
- `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared-kernel\shared-kernel.c4` — modelo LikeC4 del módulo
- `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared-kernel\diagram.md` — diagrama adicional
- `D:\Cristian\Nest\admin-back\apps\ledger\docs\accounts\README.md` — documentación arc42-lite del módulo accounts
- `D:\Cristian\Nest\admin-back\apps\ledger\docs\transactions\README.md` — documentación arc42-lite del módulo transactions

---

## Gaps detectados

1. **`ConsistencyVerifier` no existe en el código** — debe construirse desde cero en esta historia.
2. **`rebuildAll()` no existe en `ProjectionRebuilder`** — el método `rebuild` existe pero sin versión que itere todas las proyecciones. Se necesita agregar `rebuildAll` y el tipo `RebuildReport`.
3. **Sin infraestructura CLI** — no hay `nestjs-command`, `CommandRunner`, ni scripts Nx de consola. Debe crearse un adaptador driving para invocar rebuild/verify.
4. **`ProjectionRebuilder.rebuild` acepta `RebuildTarget` (explícito) en vez de `projectionName`** — la HU pide `rebuild(projectionName)`. Podría requerir un refactor o un registro de proyecciones por nombre.
5. **`work/ledger/EP-1-nucleo.md` no existe** en disco — la HU lo referencia como fuente de diseño original, pero el archivo nunca fue creado. La especificación detallada está en `hu.md`.
6. **`ledger-roadmap.md` en raíz no existe** — el roadmap real está en `docs/roadmap.md`.
