# context: hu-0004

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** el puerto de escritura de read models (`ReadModelStore`), la base `Projector`, el
`ProjectionDispatcher` con sus dos modos (síncrono y asíncrono), y el proyector
`account_tree` con el derivador `TransactionKindDeriver`
**Para** tener la superficie de lectura de cuentas lista antes de `hu-0005` (command handlers que validan posting↔cuenta).

## App / Lib afectados

- `apps/ledger` (único)

---

## apps/ledger — Subsistema de proyecciones (shared-kernel + accounts + transactions)

### Estado general: código ya existente

> **Aviso:** Todos los artefactos descritos en `hu.md` (puertos, adaptadores, projectores, deriver) **ya existen** en el código base — fueron construidos como parte del flujo anterior (`hu-0001` a `hu-0003`). El gap principal detectado es la **ausencia de un contract test reutilizable para `ReadModelStore`** (mismo patrón que `describeEventStoreContract` en `hu-0002`).

---

### 1. Puertos de aplicación (`shared-kernel/application/projection/`)

#### `ReadModelStore` (puerto de persistencia de read models, RNF-10)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\read-model-store.ts`

```typescript
export abstract class ReadModelStore {
  abstract upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>;
  abstract delete(table: string, key: ReadModelKey): Promise<void>;
  abstract query<TRow>(table: string, criteria: Criteria): Promise<TRow[]>;
  abstract truncate(table: string): Promise<void>;
}
```

Tipos auxiliares: `ReadModelKey = Readonly<Record<string, string>>`, `ReadModelRow = Readonly<Record<string, unknown>>`.

#### `Projector` (base de projector, agnóstico del modo)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projector.ts`

```typescript
export abstract class Projector {
  abstract readonly name: string;
  abstract readonly consumes: readonly string[];
  abstract project(event: StoredEvent, store: ReadModelStore): Promise<void>;
  handles(eventType: string): boolean { return this.consumes.includes(eventType); }
}
```

#### `ProjectionDispatcher` (puerto de dispatch)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projection-dispatcher.ts`

```typescript
export abstract class ProjectionDispatcher {
  abstract dispatch(events: readonly StoredEvent[]): Promise<void>;
}
```

#### `ProjectionCheckpointRepository` (tracking de posición para poller)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\projection-checkpoint.repository.ts`

```typescript
export abstract class ProjectionCheckpointRepository {
  abstract lastPosition(projectionName: string): Promise<bigint>;
  abstract advance(projectionName: string, position: bigint): Promise<void>;
}
```

---

### 2. Adaptadores de infraestructura (`shared-kernel/infrastructure/`)

#### `SynchronousProjectionDispatcher` (modo síncrono, read-your-writes, RNF-9)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\projection\synchronous-dispatcher.ts`

Constructor: `(projectors: readonly Projector[], store: ReadModelStore)`.
Itera eventos × projectors, ejecuta `projector.project(event, store)` inline. Una falla propaga y aborta el comando.

#### `PollingProjectionDispatcher` (modo asíncrono con checkpoint)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\projection\polling-dispatcher.ts`

Constructor: `(projectionName, eventStore, projectors, store, checkpoints, batchSize?)`.
Métodos: `dispatch(events)`, `pollOnce()`, `catchUp()`. Usa `EventStore.readAll(fromPosition, limit)` y avanza checkpoint por `globalPosition`.

#### `InMemoryReadModelStore` (doble de test)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\in-memory\in-memory-read-model-store.ts`

Implementa `upsert`, `delete`, `query`, `truncate` sobre `Map<string, Map<string, ReadModelRow>>`. Evalúa `Criteria` in-process. Soporta todos los `FilterOperator`.

**Spec:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\in-memory\in-memory-read-model-store.spec.ts` (test unitario standalone — **NO es un contract test**).

#### `PostgresReadModelStore` (adaptador real)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\postgres\postgres-read-model-store.ts`

Usa `DataSource` (TypeORM). Implementa `upsert` (INSERT ON CONFLICT DO UPDATE), `delete`, `query`, `truncate`. Métodos extra: `queryRaw`, `queryOneRaw`. **No tiene spec file propio.**

#### `InMemoryProjectionCheckpointRepository`

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\projection\in-memory-projection-checkpoint.repository.ts`

Mapa `Map<string, bigint>` para tests.

#### `ProjectionRebuilder` (RNF-5)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\projection\projection-rebuilder.ts`

Trunca tablas de un `RebuildTarget`, resetea checkpoint y replaya el stream completo con `PollingProjectionDispatcher.catchUp()`. Método `isCaughtUp()` para verificar sincronía.

---

### 3. Proyector `account_tree` (`accounts/infrastructure/projections/`)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\projections\account-tree.projector.ts`

- `name = 'account_tree'`
- `consumes = ['AccountOpened', 'AccountRenamed', 'AccountClosed']`
- Tabla: `PROJ_ACCOUNTS = 'proj_accounts'`
- `AccountRow`: `account_id, user_id, type, name, parent_id, currency_code, opened_on, closed_on, is_bank_mirror, is_system`
- `onOpened`: inserta fila, resuelve `parent_id` desde `proj_accounts` por nombre.
- `onRenamed`: actualiza nombre de la cuenta + reprefija **todos los descendientes** (§6.3) usando `AccountName.reparentFrom`.
- `onClosed`: marca `closed_on` vía upsert.
- `resolveParentId`: consulta `proj_accounts` por `user_id` + `name`.

**Spec:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\projections\account-tree.projector.spec.ts`

3 tests: apertura con parent_id, propagación de renombre a descendientes, cierre con `closed_on`. Usa `InMemoryReadModelStore`.

---

### 4. Derivador `TransactionKindDeriver` (`transactions/domain/derivation/`)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\derivation\transaction-kind.deriver.ts`

```typescript
export class TransactionKindDeriver {
  derive(accountTypes: readonly AccountType[]): DerivedKind {
    if (accountTypes.includes(AccountType.EXPENSES)) return DerivedKind.EXPENSE;
    if (accountTypes.includes(AccountType.INCOME)) return DerivedKind.INCOME;
    const onlyReal = accountTypes.every(t => t === AccountType.ASSETS || t === AccountType.LIABILITIES);
    return onlyReal ? DerivedKind.TRANSFER : DerivedKind.COMPOUND;
  }
}
```

**Enum `DerivedKind`:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\derivation\derived-kind.ts`

Valores: `EXPENSE`, `INCOME`, `TRANSFER`, `COMPOUND`.

**Spec:** `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\derivation\transaction-kind.deriver.spec.ts`

Cubre los 4 branches (EXPENSE, INCOME, TRANSFER, COMPOUND).

**Consumido por:** `TransactionListProjector` en `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\infrastructure\projections\transaction-list.projector.ts` — instanciado como default `new TransactionKindDeriver()`.

---

### 5. Composition root (`ledger/application/`)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\application\ledger-application.factory.ts`

`createLedgerApplication(deps: LedgerApplicationDeps): LedgerApplication` — wiring del write side:
- Projectors: `AccountTreeProjector`, `TransactionListProjector`, `AccountBalancesProjector`, `LedgerSettingsProjector`
- Dispatcher: `new SynchronousProjectionDispatcher(projectors, readModel)` (modo síncrono, RNF-9)
- CommandBus con políticas: `AuthenticatedContextPolicy`, `IdempotencyPolicy`, `OptimisticConcurrencyPolicy`
- Handlers registrados: `InitializeLedger`, `OpenAccount`, `RenameAccount`, `CloseAccount`, `RecordTransaction`, `ConfirmTransaction`, `AmendPendingTransaction`, `AnnotateTransaction`, `VoidPendingTransaction`, `ReverseConfirmedTransaction`

**Módulo NestJS:** `D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\ledger-core.module.ts`

`@Global()`, provee `EventStore` (Postgres), `ReadModelStore` (Postgres), `CommandBus`, `QueryBus`, `CurrencyCatalog`, `Clock`, `IdGenerator`.

---

### 6. Read-side queries (consumen `ReadModelStore`)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\read-side\query-bus.factory.ts`

`createQueryBus(readModel: ReadModelStore): QueryBus` — registra 6 handlers que leen de `proj_accounts` y otras tablas: `ListTransactions`, `GetTransactionById`, `GetAccountTree`, `GetAccountById`, `GetAccountBalances`, `GetLedgerSettings`.

---

### 7. DTOs HTTP existentes (`accounts/infrastructure/adapters/http/dto/`)

**Barrel:** `D:\Cristian\Nest\admin-back\apps\ledger\src\accounts\infrastructure\adapters\http\dto\index.ts`

DTOs exportados (relevantes para el dominio de cuentas):
- `AccountDto`, `AccountBalanceDto`, `AccountBalanceQueryDto`, `AccountTreeDto`, `AccountTreeView`, `AccountTreeQueryDto`, `OpenAccountRequestDto`, `RenameAccountRequestDto`, `CloseAccountRequestDto`, `InitializeLedgerRequestDto`, `LedgerSettingsDto`

---

### 8. Eventos de dominio reutilizados

| Evento | Archivo | Campos clave |
|--------|---------|--------------|
| `AccountOpened` | `.../accounts/domain/account/events/account-opened.event.ts` | `accountId, type, name, parentName, currencies, openedOn, isBankMirror, isSystem` |
| `AccountRenamed` | `.../accounts/domain/account/events/account-renamed.event.ts` | `previousName, newName` |
| `AccountClosed` | `.../accounts/domain/account/events/account-closed.event.ts` | `closedOn` |

Todos extienden `DomainEvent` y tienen `eventType`, `schemaVersion`, `fromPayload()`, `toPayload()`.

Barrel: `.../accounts/domain/account/events/index.ts`

---

### 9. Artefactos de dominio reutilizados

| Artefacto | Archivo |
|-----------|---------|
| `AccountType` (enum: ASSETS, LIABILITIES, INCOME, EXPENSES, EQUITY) | `.../shared-kernel/domain/value-objects/account-type.ts` |
| `AccountName` (VO inmutable, `reparentFrom`, `isDescendantOf`) | `.../shared-kernel/domain/value-objects/account-name.ts` |
| `StoredEvent` (= `EventEnvelope & { globalPosition: bigint }`) | `.../shared-kernel/domain/event/stored-event.type.ts` |
| `EventStore` (puerto abstracto) | `.../shared-kernel/domain/ports/event-store.ts` |
| `Criteria` (builder inmutable, filtros, orden, paginación) | `.../libs/shared/src/criteria/criteria.ts` |
| `FilterOperator` (enum: EQUAL, NOT_EQUAL, GT, GTE, LT, LTE, BETWEEN, CONTAINS, IN, IS_NULL, ...) | `.../libs/shared/src/criteria/filter-operator.ts` |

---

### 10. Documentación disponible

| Módulo | Path |
|--------|------|
| Accounts | `D:\Cristian\Nest\admin-back\apps\ledger\docs\accounts/` (api.yaml, component.md, diagram.md, postman_collection.json) |
| Shared-kernel | `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared-kernel/` (component.md, diagram.md) |
| Transactions | `D:\Cristian\Nest\admin-back\apps\ledger\docs\transactions/` (api.yaml, component.md, diagram.md, postman_collection.json) |

---

## Gaps detectados

1. **Contract test de `ReadModelStore` ausente.** El patrón de `hu-0002` (`describeEventStoreContract` en `shared-kernel/infrastructure/testing/event-store.contract.ts`) no tiene equivalente para `ReadModelStore`. `hu.md` AC menciona explícitamente: "contract tests para `ReadModelStore` (mismo patrón que `EventStore` en `hu-0002`: una sola suite reutilizable entre in-memory y Postgres)". Actualmente:
   - `InMemoryReadModelStore` tiene un test standalone (`in-memory-read-model-store.spec.ts`) que prueba la implementación concreta directamente, sin contrato reutilizable.
   - `PostgresReadModelStore` **no tiene spec file propio**.

2. **PostgresReadModelStore sin test.** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\postgres\postgres-read-model-store.ts` carece de cualquier spec. Para cerrar este gap haría falta crear el contract test reutilizable y correrlo tanto contra `InMemoryReadModelStore` como contra `PostgresReadModelStore`.

3. **Todo el código descrito en `hu.md` ya existe.** Los puertos, adaptadores, projectores, dispatcher síncrono/asíncrono, `AccountTreeProjector` y `TransactionKindDeriver` están completamente implementados y cableados en `createLedgerApplication()`. La historia debe concentrarse en los tests de contrato faltantes (gap #1 y #2) y verificar cobertura sobre el código ya existente.

4. **Rama actual: `feat/core`** (no `develop`). El scan se ejecutó sobre `feat/core` — la base puede tener código más adelantado que `develop`. Si se necesita escanear sobre `develop` limpio, ejecutar `/sync` primero.
