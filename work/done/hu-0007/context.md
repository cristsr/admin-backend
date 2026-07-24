# context: hu-0007

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** el adaptador `PostgresEventStore` (esquema §6.1: tabla append-only, trigger de inmutabilidad, índices únicos, `projection_checkpoints`) y el adaptador Postgres de `ReadModelStore` (`proj_accounts`, `proj_transactions`, `proj_postings`, `proj_balances`), ambos pasando la misma suite de contract tests que sus contrapartes in-memory
**Para** tener un event store y unas proyecciones productivas, sustituibles sin cambiar comportamiento (RNF-11)

## Apps/Libs afectados

- `apps/ledger` — adaptadores Postgres, migraciones, contract tests
- `libs/shared` — `DatabaseModule` (provee `DataSource`/TypeORM wiring)

---

## apps/ledger

### Módulo afectado
`D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\`

### General: Estructura del shared-kernel

```
shared-kernel/
├── domain/
│   ├── event/
│   │   ├── append-result.type.ts
│   │   ├── event-envelope.type.ts
│   │   ├── event-payload.type.ts
│   │   ├── stored-event.type.ts
│   │   └── stream-id.type.ts
│   ├── exceptions/
│   │   └── event-store.exception.ts
│   └── ports/
│       └── event-store.ts                ← EventStore abstract class
├── application/
│   └── projection/
│       └── read-model-store.ts           ← ReadModelStore abstract class
└── infrastructure/
    ├── adapters/
    │   ├── event-store/
    │   │   ├── in-memory/
    │   │   │   ├── in-memory-event-store.ts
    │   │   │   └── in-memory-event-store.spec.ts
    │   │   └── postgres/
    │   │       ├── postgres-event-store.ts
    │   │       ├── postgres-event-store.spec.ts
    │   │       └── event-store.row.type.ts
    │   └── read-model-store/
    │       ├── in-memory/
    │       │   ├── in-memory-read-model-store.ts
    │       │   └── in-memory-read-model-store.spec.ts
    │       └── postgres/
    │           └── postgres-read-model-store.ts
    └── testing/
        ├── event-store.contract.ts
        └── read-model-store.contract.ts
```

### EventStore port (abstract class)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\ports\event-store.ts`

**Métodos:**
- `append(stream: StreamId, expectedVersion: number, events: readonly EventEnvelope[]): Promise<AppendResult>`
- `load(stream: StreamId): Promise<readonly StoredEvent[]>`
- `readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>`
- `findByExternalRef(userId: string, externalRef: string): Promise<Nullable<StoredEvent>>`

### ReadModelStore port (abstract class)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\projection\read-model-store.ts`

**Métodos:**
- `upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>`
- `delete(table: string, key: ReadModelKey): Promise<void>`
- `query<TRow>(table: string, criteria: Criteria): Promise<TRow[]>`
- `truncate(table: string): Promise<void>`

**Tipos auxiliares:**
- `ReadModelKey = Readonly<Record<string, string>>`
- `ReadModelRow = Readonly<Record<string, unknown>>`

### Domain types (event store)

| Archivo | Tipo | Campos clave |
|---------|------|-------------|
| `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\event\event-envelope.type.ts` | `EventEnvelope` | `eventId`, `userId`, `aggregateType`, `aggregateId`, `sequence`, `eventType`, `schemaVersion`, `clientId`, `externalRef` (Nullable), `payload` (EventPayload), `occurredAt`, `recordedAt` |
| `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\event\stored-event.type.ts` | `StoredEvent` | `EventEnvelope & { globalPosition: bigint }` |
| `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\event\stream-id.type.ts` | `StreamId` | `userId`, `aggregateType`, `aggregateId` |
| `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\event\append-result.type.ts` | `AppendResult` | `events: readonly StoredEvent[]`, `version: number`, `lastPosition: bigint` |
| `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\event\event-payload.type.ts` | `EventPayload` | `Readonly<Record<string, unknown>>` |

### Domain exceptions
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\exceptions\event-store.exception.ts`

- `ConcurrencyConflictException extends DomainConflictException` — code: `'CONCURRENCY_CONFLICT'`
- `DuplicateExternalRefException extends DomainConflictException` — code: `'DUPLICATE_EXTERNAL_REF'`

### InMemoryEventStore (adaptador de referencia)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\event-store\in-memory\in-memory-event-store.ts`

- Array `StoredEvent[]` interno + contador monotónico `nextPosition: bigint`
- Implementa todos los métodos del puerto: `append`, `load`, `readAll`, `findByExternalRef`
- Valida secuencias consecutivas y unicidad de `external_ref` en proceso

**Spec:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\event-store\in-memory\in-memory-event-store.spec.ts`
```typescript
describeEventStoreContract(async () => new InMemoryEventStore());
```

### PostgresEventStore (YA EXISTE)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\event-store\postgres\postgres-event-store.ts`

- Constructor: `constructor(private readonly dataSource: DataSource)`
- `append`: inserta eventos dentro de `dataSource.transaction()`, traduce `UNIQUE_VIOLATION` a `ConcurrencyConflictException` o `DuplicateExternalRefException`
- Constantes de constraint: `uq_event_aggregate_sequence`, `idx_event_external_ref`
- Sin conversión de montos a `number` — `JSON.stringify(event.payload)` directo
- `global_position` se lee como string y se convierte con `BigInt()`

**Row type:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\event-store\postgres\event-store.row.type.ts`
```typescript
type EventStoreRow = {
  global_position: string;  // bigint comes as text from driver
  event_id: string;
  user_id: string;
  aggregate_type: string;
  aggregate_id: string;
  sequence: string;
  event_type: string;
  schema_version: number;
  client_id: string;
  external_ref: string | null;
  payload: Record<string, unknown>;
  occurred_at: Date;
  recorded_at: Date;
};
function toStoredEvent(row: EventStoreRow): StoredEvent  // maps snake_case → camelCase + BigInt
```

**Spec (YA EXISTE — gated por RUN_PG_TESTS):** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\event-store\postgres\postgres-event-store.spec.ts`
- Ejecuta `describeEventStoreContract(makeStore)` contra una DB real
- Incluye tests específicos del trigger de inmutabilidad (`UPDATE`/`DELETE` rechazados)
- Gated: `RUN_PG_TESTS=1` requerido; script `initialize()` crea/limpia la tabla vía migración

### InMemoryReadModelStore (adaptador de referencia)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\in-memory\in-memory-read-model-store.ts`

- `Map<string, Map<string, ReadModelRow>>` — per-table map keyed by serialized key
- Implementa todos los filtros de `Criteria` (EQUALS, NOT_EQUAL, IN, IS_NULL, CONTAINS, GREATER_THAN, BETWEEN, etc.)
- Soporta ordenamiento y paginación

**Spec:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\in-memory\in-memory-read-model-store.spec.ts`
```typescript
describeReadModelStoreContract(async () => new InMemoryReadModelStore());
```

### PostgresReadModelStore (YA EXISTE — con bugs)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\read-model-store\postgres\postgres-read-model-store.ts`

- Constructor: `constructor(private readonly dataSource: DataSource)`
- `upsert(table, row)`: INSERT … ON CONFLICT DO UPDATE con todas las columnas del row
- `delete`, `query`, `truncate`: SQL dinámico basado en Criteria
- Soporta todos los `FilterOperator`: EQUAL, NOT_EQUAL, IN, IS_NULL, IS_NOT_NULL, CONTAINS, EQUALS_IGNORE_CASE, GREATER_THAN, GREATER_OR_EQUAL, LESS_THAN, LESS_OR_EQUAL, BETWEEN
- Métodos extra no abstractos: `queryRaw<TRow>(sql, params?)`, `queryOneRaw<TRow>(sql, params?)`
- Usa import relativo: `'../../application/projection/read-model-store'`

**Bug detectado:** La firma de `upsert` no coincide con la clase abstracta:
- Abstracta: `upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>`
- Implementación: `upsert(table: string, row: ReadModelRow): Promise<void>` (falta el parámetro `key`)

**Spec FALTANTE:** No existe `postgres-read-model-store.spec.ts` — el contract test de AC-8 no está implementado.

### EventStore contract test suite
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\testing\event-store.contract.ts`

**Firma:** `describeEventStoreContract(makeStore: MakeEventStore, teardown?: () => Promise<void>): void`

**Casos (9):**
1. Appends to a new stream, assigning sequences and growing positions
2. Loads history ordered by sequence; returns [] for unknown stream
3. readAll returns global-position order across aggregates and respects limit
4. Rejects a stale expectedVersion and persists nothing (INV-7)
5. Lets exactly one of two same-version appends win
6. Is idempotent per external_ref and exposes the anchor via findByExternalRef
7. Isolates external_ref per user (INV-9)
8. Preserves decimal payload strings without loss
9. Leaves no partial events when a multi-event batch conflicts
10. Treats an empty batch as a no-op (AC-11)

### ReadModelStore contract test suite
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\testing\read-model-store.contract.ts`

**Firma:** `describeReadModelStoreContract(makeStore: MakeReadModelStore, teardown?: () => Promise<void>): void`

**Casos (14):**
1. Upserts a new row and queries it by EQUAL
2. Overwrites a row on repeated upsert with same key (idempotent projection)
3. Isolates tables — upsert in one doesn't appear in another
4. Deletes a row by key
5. Delete on non-existent key is a no-op
6. Queries by NOT_EQUAL
7. Queries by IN matching a subset of rows
8. Queries by IS_NULL and IS_NOT_NULL
9. Queries by CONTAINS (case-insensitive)
10. Queries by GREATER_THAN
11. Queries by BETWEEN
12. Orders ASC and DESC
13. Paginates with limitTo (sets take)
14. Paginates with skip + take
15. Returns all rows with empty Criteria
16. Truncates all rows from a table
17. Truncate of one table does not affect another

### Migraciones (YA EXISTEN)

| Migración | Archivo | Crea |
|-----------|---------|------|
| `CreateEventStore1790000000001` | `D:\Cristian\Nest\admin-back\apps\ledger\src\database\migrations\1790000000001-CreateEventStore.ts` | `event_store` (BIGINT GENERATED ALWAYS AS IDENTITY PK, UUIDs, jsonb payload, trigger `trg_event_store_immutable`, índices: `uq_event_aggregate_sequence`, `idx_event_external_ref` (parcial), `idx_event_aggregate`, `idx_event_user`) |
| `CreateProjectionCheckpoints1790000000002` | `D:\Cristian\Nest\admin-back\apps\ledger\src\database\migrations\1790000000002-CreateProjectionCheckpoints.ts` | `projection_checkpoints` (projection_name TEXT PK, last_position BIGINT, updated_at) |
| `CreateCoreProjections1790000000003` | `D:\Cristian\Nest\admin-back\apps\ledger\src\database\migrations\1790000000003-CreateCoreProjections.ts` | `proj_accounts`, `proj_transactions`, `proj_postings`, `proj_balances` con sus índices |

### Wiring en LedgerCoreModule (YA EXISTE)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\ledger\ledger-core.module.ts`

```typescript
{ provide: EventStore, useClass: PostgresEventStore },
{ provide: ReadModelStore, useClass: PostgresReadModelStore },
```

Los buses (`CommandBus`, `QueryBus`) se inyectan con estos adaptadores via `useFactory`.

### DatabaseModule del ledger (YA EXISTE)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\database\database.module.ts`

Delega en `SharedDatabaseModule.forRoot()` con `databaseConfig.KEY` y migrations glob `'dist/apps/ledger/database/migrations/*.js'`.

### TypeORM DataSource CLI (YA EXISTE)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\database\data-source.ts`

Configura DataSource con `type: 'postgres'`, `url: process.env.DB_URI`, migrations glob `'apps/ledger/src/database/migrations/*.ts'`.

### Documentación disponible

| Path | Contenido |
|------|-----------|
| `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared-kernel\component.md` | C4 Nivel 3 del shared-kernel (diagrama Mermaid acumulativo con todos los componentes, incluyendo `PostgresEventStore` y `PostgresReadModelStore`) |
| `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared-kernel\diagram.md` | Diagrama LikeC4 (existen hu-0001 a hu-0006) |
| `D:\Cristian\Nest\admin-back\apps\ledger\docs\shared-kernel\shared-kernel.c4` | Modelo LikeC4 del módulo |
| `D:\Cristian\Nest\admin-back\apps\ledger\docs\accounts\` | Documentación del módulo accounts (README, api.yaml, accounts.c4, flows/) |
| `D:\Cristian\Nest\admin-back\apps\ledger\docs\transactions\` | Documentación del módulo transactions (README, api.yaml, transactions.c4, flows/) |

---

## libs/shared

### DatabaseModule
**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\database\database.module.ts`

`DatabaseModule.forRoot(options: DatabaseModuleOptions): DynamicModule`
- Internamente usa `TypeOrmModule.forRootAsync`
- Options: `configKey` (InjectionToken del config namespace), `migrations` (glob), `entities`, `autoLoadEntities`
- Expone `DataSource` inyectable globalmente

### DatabaseModuleOptions
**Archivo:** `D:\Cristian\Nest\admin-back\libs\shared\src\database\database-module-options.type.ts`

```typescript
interface DatabaseModuleOptions {
  configKey: InjectionToken;
  migrations: readonly string[];
  entities?: TypeOrmModuleOptions['entities'];
  autoLoadEntities?: boolean;
}
```

---

## Patrones de referencia (apps/finances)

### saveWithinTransaction (outbox)
**Archivo:** `D:\Cristian\Nest\admin-back\apps\finances\src\outbox\infrastructure\adapters\persistence\typeorm\typeorm-outbox.repository.ts:15`

```typescript
async saveWithinTransaction(manager: EntityManager, event: {...}): Promise<void> {
  await manager.insert(TypeOrmOutboxEventEntity, { ... });
}
```

El patrón recibe un `EntityManager` de una transacción ya abierta y hace inserts dentro de ella — así el outbox comparte unidad de trabajo con la operación de negocio.

### MigrationInterface template
**Archivo:** `D:\Cristian\Nest\admin-back\apps\finances\src\database\migrations\1784073600021-CreateOutboxEventsTable.ts`

Forma canónica:
```typescript
export class CreateOutboxEventsTable1784073600021 implements MigrationInterface {
  name = 'CreateOutboxEventsTable1784073600021';
  public async up(queryRunner: QueryRunner): Promise<void> { ... }
  public async down(queryRunner: QueryRunner): Promise<void> { ... }
}
```

---

## Gaps detectados

1. **Bug: `PostgresReadModelStore.upsert` signature mismatch** — La implementación omite el parámetro `key: ReadModelKey` que la clase abstracta `ReadModelStore` declara. La firma actual es `upsert(table: string, row: ReadModelRow)` en vez de `upsert(table: string, key: ReadModelKey, row: ReadModelRow)`. El `ON CONFLICT` actual usa todas las columnas del row, pero debería usar solo las columnas del `key` para la cláusula de conflicto y el resto para `UPDATE SET`.

2. **AC-8 no verificado: falta `postgres-read-model-store.spec.ts`** — No existe spec que ejecute `describeReadModelStoreContract` contra `PostgresReadModelStore`. El adaptador in-memory sí lo tiene (`in-memory-read-model-store.spec.ts`), pero el de Postgres no. Esto bloquea el AC-8.

3. **`PostgresReadModelStore` usa import relativo** — Importa `ReadModelStore` con `'../../application/projection/read-model-store'` en vez del path alias `@ledger/shared-kernel/...`. No es un bug funcional pero viola la convención del proyecto.

4. **`PostgresEventStore.append` inserta eventos uno por uno** (línea 98-123) — La HU pide `INSERT` multi-fila (un solo round-trip). Actualmente hace un `for` loop con `manager.query(INSERT ... RETURNING ...)` por cada evento, lo cual es N round-trips. AC-2 no lo especifica explícitamente pero las restricciones técnicas de la HU sí piden batch insert.

5. **Falta documentación de flows para shared-kernel** — `apps/ledger/docs/shared-kernel/flows/` no existe. Los flows documentan casos de uso concretos (append, readAll, catch-up, rebuild). Las HU anteriores (hu-0001 a hu-0006) ya están syncadas pero no generaron flows para el event store ni las proyecciones a nivel infraestructura.
