# EP-1 — Núcleo de dominio, puertos y adaptadores base (Fase 1)

> Épica del [roadmap](../../ledger-roadmap.md). Fuente: [especificación](../../especificacion-tecnica-ledger.md).
> Este archivo debe contener el **plan detallado de implementación** de la épica.

## Alcance (subtareas)

- **EP-1.1** Value objects: `AccountName`, `Payee`, `PostingLine`, `Currency`.
- **EP-1.2** Envelope de eventos + serialización de montos como strings decimales (RNF-2).
- **EP-1.3** Puerto `EventStore` (`append`/`load`/`readAll`) + `Clock`/`IdGenerator` con su semántica.
- **EP-1.4** Adaptador in-memory de `EventStore` + contract tests.
- **EP-1.5** Adaptador `PostgresEventStore` (§6.1) que pasa los mismos contract tests.
- **EP-1.6** Agregado `Account` (`Opened`/`Renamed`/`Closed`); INV-3 parcial, INV-4, INV-13, INV-14.
- **EP-1.7** Agregado `LedgerTransaction`; INV-1 (componente único INV-11), INV-2, INV-6.
- **EP-1.8** Command bus + políticas transversales + handlers núcleo.
- **EP-1.9** Puerto `ReadModelStore` + `ProjectionDispatcher` (síncrono + poller con checkpoint).
- **EP-1.10** Proyectores `account_tree`, `transaction_list` (+`proj_postings`), `account_balances`; derivador `derived_kind`.
- **EP-1.11** Query bus + query handlers.
- **EP-1.12** Tooling de rebuild/replay + verificación stream vs proyección (RNF-5).

## Plan detallado

### Convenciones y supuestos transversales

Aplican a **todas** las subtareas y no se repiten en cada una:

- **Alias de path** (los declara EP-0.1): `@ledger/*` → `apps/ledger/src/*`, `@shared` →
  `libs/shared/src/index.ts` (ya existe). `Money` decimal, `Nullable<T>`, `Criteria`, la
  jerarquía de excepciones (`DomainException` → `DomainConflictException` /
  `DomainUnprocessableException` / `DomainNotFoundException`) y `PropertiesOnly` se
  importan de `@shared` (patrón ya usado en `apps/finances`, p.ej.
  `apps/finances/src/account/domain/account/entities/account.entity.ts:1`).
- **Puertos = clases abstractas**, nunca `interface` (regla `typescript`; ver
  `apps/finances/src/account/domain/account/repositories/account.repository.ts:10` y
  `apps/finances/src/outbox/domain/outbox-event/outbox.repository.ts:9`). Las **formas de
  datos** puras (envelope, payload, snapshots de proyección, args de comando) se declaran
  como `type` en archivos `*.type.ts`.
- **Núcleo libre de NestJS** (RNF-11): `domain/` y `application/` no importan
  `@nestjs/*` ni `typeorm`. NestJS solo aparece en `infrastructure/` y en los módulos.
  Los puertos se materializan como tokens de inyección en los módulos (patrón de
  `finances`).
- **Comentarios en inglés + JSDoc** en clases, métodos, tipos exportados y props no
  obvias; `//` solo para notas locales (CLAUDE.md).
- **Money y RNF-2/INV-8**: `Money` decimal (lo entrega EP-0.3) prohíbe construcción desde
  `number`; los montos viajan como **string decimal** en payloads de evento y en DTOs, y
  como `NUMERIC` en proyecciones. Ninguna capa del núcleo usa `number` para dinero.
- **TDD estricto**: cada archivo de producción se precede por su `*.spec.ts`. Los puertos
  se prueban con **contract tests** reutilizables (una única suite corre contra in-memory
  y Postgres).
- **Sin enums de DB** (MEMORY / CLAUDE.md): `status`, `derived_kind`, `aggregate_type`,
  `event_type` son `varchar`/`text`; los enums viven solo en el app layer.

Layout hexagonal por módulo propuesto bajo `apps/ledger/src` (creado por EP-0, poblado por
EP-1):

```
apps/ledger/src/
  shared-kernel/                     # hexágono base del event sourcing (sin dominio contable)
    domain/
      aggregate/                     # AggregateRoot, DomainEvent
      event/                         # EventEnvelope, StoredEvent, EventPayload, StreamId (types)
      ports/                         # EventStore, Clock, IdGenerator (clases abstractas)
      exceptions/                    # ConcurrencyConflict, DuplicateExternalRef
    application/
      command-bus/                   # CommandBus, CommandHandler, políticas
      query-bus/                     # QueryBus, QueryHandler
      projection/                    # Projector, ProjectionDispatcher (port), ReadModelStore (port)
      event-sourced.repository.ts    # base load/save sobre EventStore
    infrastructure/
      adapters/
        event-store/{in-memory,postgres}/
        read-model-store/{in-memory,postgres}/
        clock/system-clock.provider.ts
        id-generator/uuid-id-generator.provider.ts
        projection/{synchronous-dispatcher, polling-dispatcher}/
      testing/                       # fábricas de contract tests + Clock/IdGenerator deterministas
    shared-kernel.module.ts
  accounts/{domain,application,infrastructure}/    # Account + account_tree
  transactions/{domain,application,infrastructure}/# LedgerTransaction + transaction_list, proj_postings, balances
  ledger/{domain,application,infrastructure}/      # InitializeLedger + cuentas técnicas + ledger_settings mínimo
  read-side/                         # query handlers + rebuild/replay tooling (o repartido por módulo)
  database/migrations/               # DDL de event_store, projection_checkpoints y proyecciones
```

---

### EP-1.1 — Value objects: `AccountName`, `Payee`, `PostingLine`, `Currency`

**Objetivo.** Modelar los value objects inmutables del dominio contable que sustentan la
validación de jerarquía/nombres (§2.1, §2.1.1), el payee de primera clase (§2.2), la línea
de asiento (§2.3) y la moneda con su precisión (§2.5). Toda invariante estructural que no
requiera estado externo se verifica en la construcción del VO (guard clauses).

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/domain/value-objects/account-name.ts`
- `apps/ledger/src/shared-kernel/domain/value-objects/account-name.spec.ts`
- `apps/ledger/src/shared-kernel/domain/value-objects/account-type.ts` (enum app-layer de los 5 tipos raíz)
- `apps/ledger/src/shared-kernel/domain/value-objects/payee.ts` (+ spec)
- `apps/ledger/src/shared-kernel/domain/value-objects/currency-code.ts` (+ spec)
- `apps/ledger/src/shared-kernel/domain/value-objects/currency.ts` (code + minorUnits) (+ spec)
- `apps/ledger/src/shared-kernel/domain/value-objects/currency-catalog.ts` (puerto: minorUnits por código; seed COP=0/USD=2 hasta EP-4 `CurrencyRegistered`)
- `apps/ledger/src/transactions/domain/posting/posting-line.ts` (+ spec)
- `apps/ledger/src/shared-kernel/domain/value-objects/index.ts`

**Firmas clave.**

```ts
/** The five Beancount-style root types. Enum lives only in the app layer (no DB enum). */
export enum AccountType {
  ASSETS = 'ASSETS',
  LIABILITIES = 'LIABILITIES',
  INCOME = 'INCOME',
  EXPENSES = 'EXPENSES',
  EQUITY = 'EQUITY',
}

/**
 * Hierarchical account name ('Assets:Bancolombia:Savings'). Immutable. The root
 * segment must be one of the five root types; segments are non-empty and the
 * root type is fixed for the lifetime of the name (INV-14 support).
 */
export class AccountName {
  private constructor(
    private readonly segments: readonly string[],
  ) {}

  static of(raw: string): AccountName;                 // parses + validates (throws InvalidAccountNameException)
  get rootType(): AccountType;                          // first segment mapped to AccountType
  get value(): string;                                  // 'Assets:Bancolombia:Savings'
  parentName(): Nullable<AccountName>;                  // null for a root-level account
  isDescendantOf(other: AccountName): boolean;          // prefix match on full segments
  /** Re-roots this name under a new prefix, preserving the tail — used to propagate renames. */
  reparentFrom(oldPrefix: AccountName, newPrefix: AccountName): AccountName;
  equals(other: AccountName): boolean;
}

/** Merchant/counterparty (§2.2). Trimmed, bounded; blank collapses to null. */
export class Payee {
  private constructor(private readonly raw: string) {}
  static of(raw: Nullable<string>): Nullable<Payee>;
  get value(): string;
}

/** ISO-like currency code, normalized upper-case, non-empty. */
export class CurrencyCode {
  static of(raw: string): CurrencyCode;
  get value(): string;
}

/** A currency and its precision (minor_units). Money uses this to enforce scale (INV-8). */
export class Currency {
  static of(code: CurrencyCode, minorUnits: number): Currency;
  get code(): string;
  get minorUnits(): number;
}

/**
 * A single ledger posting: an account reference plus a signed Money and free
 * metadata. Currency is carried by Money; there is never an amount without a
 * currency (§2.3, principle 9.4.1).
 */
export type PostingLine = {
  readonly accountId: string;
  readonly amount: Money;              // decimal Money from @shared (INV-8)
  readonly metadata: Readonly<Record<string, string>>;
};
```

**Invariantes reforzadas.**

- **INV-8 / RNF-2**: `PostingLine.amount` es `Money` decimal; `Currency.minorUnits` es la
  fuente de verdad de la escala que `Money` respeta al construir.
- **INV-14 (soporte)**: `AccountName.rootType` es derivado e inmutable; `reparentFrom`
  nunca cambia el tipo raíz (test explícito de que renombrar bajo otra raíz lanza).
- **INV-2 (soporte)**: `PostingLine` es la unidad que el agregado contará (`>= 2`).

**Plan TDD (tests primero).**

1. `account-name.spec.ts`: parseo válido multi-segmento; rechazo de raíz inválida, de
   segmento vacío, de separadores dobles; `parentName` de raíz = `null`;
   `isDescendantOf` verdadero/falso; `reparentFrom` conserva cola y **rechaza** cambio de
   raíz; `equals`.
2. `payee.spec.ts`: trim, colapso de blanco a `null`, tope de longitud.
3. `currency-code.spec.ts` / `currency.spec.ts`: normalización mayúsculas, `minorUnits`
   no negativo, catálogo seed COP=0/USD=2.
4. `posting-line.spec.ts`: construcción con `Money`; metadata inmutable.

**Criterios de aceptación.** Todos los VO son inmutables (`readonly`, sin setters),
construidos por factories estáticas con guard clauses, cubiertos por tests, sin dependencia
de infraestructura ni NestJS.

**Dependencias y riesgos.** Depende de `Money` decimal (EP-0.3). Riesgo: la fuente de
`minorUnits` antes de EP-4 (`CurrencyRegistered`). Mitigación: `CurrencyCatalog` como puerto
con adaptador seed (COP/USD); EP-4 lo reemplaza por proyección sin tocar el núcleo.

---

### EP-1.2 — Envelope de eventos + serialización decimal

**Objetivo.** Definir la base `DomainEvent`, el sobre `EventEnvelope`/`StoredEvent`, el
contrato de payload (`EventPayload`) con montos como **strings decimales** (RNF-2), y el
registro de (de)serialización con hook de **upcasting** (RNF-6). Es el contrato que cruza el
write side hacia el event store y hacia los projectors.

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/domain/aggregate/domain-event.ts`
- `apps/ledger/src/shared-kernel/domain/event/event-envelope.type.ts`
- `apps/ledger/src/shared-kernel/domain/event/stored-event.type.ts`
- `apps/ledger/src/shared-kernel/domain/event/event-payload.type.ts`
- `apps/ledger/src/shared-kernel/domain/event/stream-id.type.ts`
- `apps/ledger/src/shared-kernel/application/event/event-registry.ts` (map `event_type` → deserializador/upcaster) (+ spec)
- `apps/ledger/src/shared-kernel/application/event/envelope.factory.ts` (envuelve `DomainEvent` + `AuthContext` + `Clock`/`IdGenerator`) (+ spec)

**Firmas clave.**

```ts
/**
 * A domain fact emitted by an aggregate. Carries no envelope metadata (that is
 * added by the application layer at append time). `schemaVersion` drives
 * upcasting on read (RNF-6). `toPayload` yields a plain JSON object with every
 * amount as a decimal string (RNF-2) — never a float (INV-8).
 */
export abstract class DomainEvent {
  abstract readonly eventType: string;      // 'TransactionRecorded'
  abstract readonly schemaVersion: number;  // starts at 1
  abstract toPayload(): EventPayload;
}

/** JSON-safe payload. Amounts are decimal strings; no floats anywhere. */
export type EventPayload = Readonly<Record<string, unknown>>;

/** Identifies one aggregate stream. userId scopes idempotency and INV-9. */
export type StreamId = {
  readonly userId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
};

/** Envelope built at append time (§3.4). Immutable data shape. */
export type EventEnvelope = {
  readonly eventId: string;
  readonly userId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly sequence: number;            // version within the aggregate (1-based)
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly clientId: string;            // opaque provenance (§2.10)
  readonly externalRef: Nullable<string>;
  readonly payload: EventPayload;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
};

/** Persisted envelope with its global position (assigned by the store). */
export type StoredEvent = EventEnvelope & { readonly globalPosition: bigint };

/** Turns event_type + schemaVersion + payload back into a typed DomainEvent, upcasting old versions. */
export abstract class EventRegistry {
  abstract deserialize(eventType: string, schemaVersion: number, payload: EventPayload): DomainEvent;
  abstract register(eventType: string, deserializer: EventDeserializer): void;
}
```

**Invariantes reforzadas.**

- **RNF-2 / INV-8**: `toPayload` serializa `Money` con `Money.toString()`/`toDecimalString()`
  (string), nunca `number`; test que falla si aparece un `number` de dinero en el payload.
- **RNF-6**: `EventRegistry` centraliza upcasting; nunca se migran eventos in situ.
- **INV-9**: `userId` es obligatorio en el envelope; ninguna construcción sin él.
- **Envelope inmutable**: sin setters, `readonly`, base para INV-12.

**Plan TDD.**

1. `event-payload`/serialización: un `DomainEvent` de prueba con un `Money` COP y otro USD
   serializa a strings `"31900"` / `"7.99"`; round-trip payload→evento→payload estable.
2. `event-registry.spec.ts`: deserialización por `event_type`; **upcasting** de
   `schemaVersion` 1→2 con un evento de prueba; error tipado ante `event_type` desconocido.
3. `envelope.factory.spec.ts`: envelope poblado con `event_id`/`recorded_at` deterministas
   (Clock/IdGenerator de test), `sequence` correlativo, `userId`/`clientId`/`externalRef`
   propagados del `AuthContext`.

**Criterios de aceptación.** Serialización decimal verificada; upcasting demostrado con un
evento versionado; envelope construido de forma determinista en tests.

**Dependencias y riesgos.** Depende de EP-1.1 (`Money`). Riesgo: acoplar el esquema de
payload al de proyección; mitigación: payloads autocontenidos, proyecciones libres de leer
lo que necesiten.

---

### EP-1.3 — Puerto `EventStore` + `Clock` + `IdGenerator`

**Objetivo.** Especificar el contrato del puerto central con **semántica completa**:
concurrencia optimista por `expectedVersion`, idempotencia observable por `external_ref`
(INV-10), orden por posición global en `readAll`, y append atómico (INV-7). Definir
`Clock`/`IdGenerator` deterministas en tests. Definir la base `EventSourcedRepository`.

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/domain/ports/event-store.ts`
- `apps/ledger/src/shared-kernel/domain/ports/clock.ts`
- `apps/ledger/src/shared-kernel/domain/ports/id-generator.ts`
- `apps/ledger/src/shared-kernel/domain/event/append-result.type.ts`
- `apps/ledger/src/shared-kernel/domain/exceptions/concurrency-conflict.exception.ts`
- `apps/ledger/src/shared-kernel/domain/exceptions/duplicate-external-ref.exception.ts`
- `apps/ledger/src/shared-kernel/application/event-sourced.repository.ts` (base genérica load/save)

**Firmas clave.**

```ts
/**
 * Append-only event store (INV-12). Optimistic concurrency per aggregate
 * (INV-7): expectedVersion is the sequence the caller believes is the current
 * head — 0 for a new stream. A mismatch throws ConcurrencyConflictException.
 *
 * Idempotency (INV-10): external_ref is stamped on the command's ANCHOR event
 * only (the first emitted). Appending a batch whose anchor external_ref already
 * exists for the user is a no-op; the store surfaces it as DuplicateExternalRef
 * so the command-bus policy can short-circuit and return the original outcome
 * (see EP-1.8). The unique index is defense-in-depth (RNF-1); the primary
 * idempotency check runs in the bus via findByExternalRef.
 *
 * readAll returns events strictly ordered by global_position, batched, for
 * projection catch-up.
 */
export abstract class EventStore {
  abstract append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult>;

  /** Full ordered history of one aggregate; empty array when the stream is unknown. */
  abstract load(stream: StreamId): Promise<readonly StoredEvent[]>;

  /** Global-position-ordered slice for projections. Scoped to a user is optional per adapter. */
  abstract readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>;

  /** Idempotency lookup: the anchor event of the command that used this external_ref, if any. */
  abstract findByExternalRef(userId: string, externalRef: string): Promise<Nullable<StoredEvent>>;
}

export type AppendResult = {
  readonly events: readonly StoredEvent[];
  readonly version: number;             // new head sequence
  readonly lastPosition: bigint;        // for read-your-writes (RNF-9)
};

export abstract class Clock {
  abstract now(): Date;                 // UTC (RNF-7)
}

export abstract class IdGenerator {
  abstract uuid(): string;
}
```

`EventSourcedRepository<TAggregate>` base:

```ts
/** Reconstructs an aggregate from its stream and persists its uncommitted changes atomically. */
export abstract class EventSourcedRepository<TAggregate extends AggregateRoot<unknown>> {
  protected abstract readonly aggregateType: string;
  protected abstract rehydrate(events: readonly DomainEvent[]): TAggregate;

  protected constructor(
    protected readonly eventStore: EventStore,
    protected readonly registry: EventRegistry,
    protected readonly envelopes: EnvelopeFactory,
  ) {}

  async load(userId: string, aggregateId: string): Promise<Nullable<TAggregate>>;
  async save(aggregate: TAggregate, ctx: AuthContext): Promise<AppendResult>;
}
```

**Invariantes reforzadas.** INV-7 (append atómico + concurrencia optimista), INV-10
(idempotencia observable), INV-12 (append-only, sin métodos de update/delete en el puerto),
INV-9 (`userId` en `StreamId`/lookup), RNF-9 (`lastPosition`), RNF-7 (`Clock` en UTC).

**Plan TDD.** Este puerto **no** se prueba con specs propios sino con la **suite de contract
tests** (EP-1.4/1.5), definida aquí como contrato:

- `apps/ledger/src/shared-kernel/infrastructure/testing/event-store.contract.ts` exporta
  `describeEventStoreContract(makeStore: () => Promise<EventStore>, teardown)`.

**Criterios de aceptación.** El puerto queda declarado como clase abstracta con JSDoc que
documenta excepciones, orden e idempotencia; la suite de contract tests compila y describe
todos los casos (aunque aún sin adaptador que la satisfaga hasta EP-1.4).

**Dependencias y riesgos.** Depende de EP-1.2. **Riesgo/decisión abierta clave**: la tensión
`external_ref` único (§6.1 `idx_event_external_ref`) vs. commands multi-evento
(`MergePendingTransfers`, `ResolveDiscrepancy`, reversa). Resolución propuesta: **anchor-only
stamping** + short-circuit en el bus vía `findByExternalRef` (ver Decisiones abiertas). Debe
validarse con el usuario antes de EP-1.8.

---

### EP-1.4 — Adaptador in-memory de `EventStore` + contract tests

**Objetivo.** Implementar `InMemoryEventStore` que satisface el contrato completo, y
escribir la **suite de contract tests reutilizable** que definirá también EP-1.5. Habilita
testear todo el núcleo (incluido replay) sin infraestructura.

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store.spec.ts` (invoca la suite)
- `apps/ledger/src/shared-kernel/infrastructure/testing/event-store.contract.ts` (la suite)
- `apps/ledger/src/shared-kernel/infrastructure/testing/deterministic-clock.ts`
- `apps/ledger/src/shared-kernel/infrastructure/testing/fixed-id-generator.ts`

**Firmas clave.**

```ts
/** In-memory reference implementation. A monotonically increasing counter models global_position. */
export class InMemoryEventStore extends EventStore { /* ... */ }

/**
 * The single contract every EventStore adapter must satisfy (RNF-11). Run
 * identically against in-memory (EP-1.4) and Postgres (EP-1.5).
 */
export function describeEventStoreContract(
  makeStore: () => Promise<EventStore>,
  teardown?: () => Promise<void>,
): void;
```

**Contract tests (la lista canónica).**

1. `append` a un stream nuevo con `expectedVersion = 0` persiste y asigna `sequence` 1..n y
   posiciones globales crecientes.
2. `load` devuelve el historial ordenado por `sequence`; stream desconocido → `[]`.
3. `readAll(from, limit)` devuelve orden **estricto por posición global** entre agregados y
   respeta el batch `limit`.
4. **Concurrencia optimista**: `append` con `expectedVersion` desfasado lanza
   `ConcurrencyConflictException` y **no** persiste nada (atomicidad, INV-7).
5. Dos `append` concurrentes al mismo agregado con el mismo `expectedVersion`: exactamente
   uno gana; el otro conflicta.
6. **Idempotencia (INV-10)**: `append` con un `external_ref` ya usado por el usuario →
   `DuplicateExternalRefException`; `findByExternalRef` devuelve el evento ancla original;
   el conteo de eventos no aumenta.
7. `external_ref` distinto por usuario no colisiona (aislamiento por `user_id`, INV-9).
8. **Append-only (INV-12)**: el puerto no expone mutación; (para Postgres, EP-1.5 añade el
   test del trigger).
9. Round-trip de payload decimal: montos string preservados sin pérdida.
10. Atomicidad multi-evento: un batch que falla a mitad no deja eventos parciales.

**Invariantes reforzadas.** Las mismas de EP-1.3, ahora **ejecutables**.

**Criterios de aceptación.** `InMemoryEventStore` pasa el 100% de la suite; la suite queda
parametrizada por un `makeStore` para reutilizarla en Postgres.

**Dependencias y riesgos.** Depende de EP-1.3. Riesgo: modelar mal la concurrencia en memoria
(sin locks reales); mitigación: los tests de concurrencia se centran en la semántica de
`expectedVersion`, no en carreras de hilos (Node es monohilo).

---

### EP-1.5 — Adaptador `PostgresEventStore` (§6.1) que pasa los mismos contract tests

**Objetivo.** Implementar el adaptador sobre PostgreSQL con el esquema §6.1 (append-only,
trigger de inmutabilidad, índices únicos, `projection_checkpoints`) y hacer que pase **la
misma** suite de EP-1.4 (RNF-11), más los tests específicos del trigger.

**Archivos a crear.**

- `apps/ledger/src/database/migrations/1790000000001-CreateEventStore.ts` (DDL en apéndice A)
- `apps/ledger/src/database/migrations/1790000000002-CreateProjectionCheckpoints.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.spec.ts` (invoca la suite contra una DB de test)
- `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/event-store.row.type.ts` (mapeo fila↔envelope)

**Detalles de implementación.**

- `append`: `INSERT ... RETURNING global_position` de todos los eventos en **una
  transacción**. La violación de `UNIQUE (aggregate_id, sequence)` se traduce a
  `ConcurrencyConflictException`; la de `idx_event_external_ref` a
  `DuplicateExternalRefException`. Se usa el `EntityManager` de TypeORM del proyecto
  (patrón `saveWithinTransaction` de `apps/finances/.../outbox.repository.ts:11`) para que
  el append comparta unidad de trabajo con las proyecciones síncronas (EP-1.9).
- `readAll`: `WHERE global_position > $from ORDER BY global_position ASC LIMIT $limit`.
- `load`: `WHERE aggregate_id = $id AND user_id = $user ORDER BY sequence ASC`.
- Montos: `payload` es `jsonb` con strings decimales; el adaptador **no** parsea a `number`.

**Invariantes reforzadas.** INV-12 (trigger `reject_event_mutation` + test que verifica que
`UPDATE`/`DELETE` lanzan), INV-7 (unicidad `(aggregate_id, sequence)` + transacción), INV-10
(índice parcial `(user_id, external_ref)`), RNF-1 (defensa en profundidad en el storage).

**Plan TDD.**

1. Reutilizar `describeEventStoreContract(() => new PostgresEventStore(...))` — misma lista
   que EP-1.4, ahora contra Postgres real (DB de test efímera; se puede usar el
   `DatabaseModule` movido a `libs/shared` por EP-0.2).
2. Tests específicos del adaptador: `UPDATE event_store` lanza `event_store is append-only`;
   `DELETE` lanza; el índice parcial permite múltiples `external_ref IS NULL`.

**Criterios de aceptación.** El adaptador Postgres pasa **idéntica** suite que in-memory
(sustituibilidad real, RNF-11) más los tests de trigger; las migraciones corren limpio
contra DB fresca (fase de desarrollo, sin datos).

**Dependencias y riesgos.** Depende de EP-1.4 y de EP-0.2 (`DatabaseModule` en `libs/shared`).
Riesgo: performance del round-trip por evento; mitigación: `INSERT` multi-fila por batch.
Riesgo: mapear `bigint`/`global_position` a JS (usar `bigint` nativo o string; no `number`).

---

### EP-1.6 — Agregado `Account`

**Objetivo.** Modelar el ciclo de vida de la cuenta (apertura, renombre, cierre) como
agregado event-sourced; proteger INV-4, INV-13, INV-14 e INV-3 (parcial: rango de fechas de
la propia cuenta). La validación posting↔cuenta (INV-3/INV-4 cruzada) se resuelve en el
handler contra la proyección `account_tree` (§3.5), no dentro de este agregado.

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/domain/aggregate/aggregate-root.ts` (base; aquí porque la
  usarán ambos agregados)
- `apps/ledger/src/accounts/domain/account/account.aggregate.ts` (+ spec)
- `apps/ledger/src/accounts/domain/account/events/account-opened.event.ts`
- `apps/ledger/src/accounts/domain/account/events/account-renamed.event.ts`
- `apps/ledger/src/accounts/domain/account/events/account-closed.event.ts`
- `apps/ledger/src/accounts/domain/account/account.repository.ts` (puerto, extiende `EventSourcedRepository`)
- `apps/ledger/src/accounts/domain/account/exceptions/account.exception.ts`
- `apps/ledger/src/accounts/domain/account/ledger-date.ts` (fecha contable plana sin zona, RNF-7)

**Firmas clave.**

```ts
/** Event-sourced aggregate base. apply() mutates state only; raise() records + applies. */
export abstract class AggregateRoot<TId> {
  private _version = 0;
  private readonly _changes: DomainEvent[] = [];

  protected constructor(readonly id: TId) {}

  get version(): number { return this._version; }
  pullChanges(): readonly DomainEvent[];               // returns and clears uncommitted events
  loadFromHistory(events: readonly DomainEvent[]): void;
  protected raise(event: DomainEvent): void;
  protected abstract apply(event: DomainEvent): void;
}

export class Account extends AggregateRoot<string> {
  private name!: AccountName;
  private type!: AccountType;
  private currencies!: readonly CurrencyCode[];
  private openedOn!: LedgerDate;
  private closedOn: Nullable<LedgerDate> = null;
  private isSystem = false;

  /** Opens an account. Real accounts (ASSETS/LIABILITIES) must declare exactly one currency (§2.1). */
  static open(args: OpenAccountArgs, idGen: IdGenerator): Account;   // raises AccountOpened

  /**
   * Renames (and re-roots within the hierarchy). The root type is immutable
   * (INV-14) and system accounts cannot be renamed (INV-13). Collision with an
   * existing name is checked by the handler against account_tree, then passed in.
   */
  rename(newName: AccountName): void;                                 // raises AccountRenamed

  /** Closes on a date. System accounts cannot be closed (INV-13). */
  close(closedOn: LedgerDate): void;                                  // raises AccountClosed

  /** INV-3 (partial): the account must be open on the posting date. */
  ensureOpenOn(date: LedgerDate): void;
  /** INV-4: the currency must be among the account's allowed currencies. */
  ensureAcceptsCurrency(code: CurrencyCode): void;

  protected apply(event: DomainEvent): void;                          // AccountOpened/Renamed/Closed
}

export type OpenAccountArgs = {
  readonly userId: string;
  readonly name: AccountName;
  readonly currencies: readonly CurrencyCode[];
  readonly openedOn: LedgerDate;
  readonly isBankMirror: boolean;
  readonly isSystem: boolean;
};
```

**Invariantes reforzadas.**

- **INV-14**: `rename` conserva `type`; test de que un nombre con otra raíz lanza
  `RootTypeImmutableException`.
- **INV-13**: `close`/`rename` sobre `isSystem` lanzan `SystemAccountProtectedException`
  (code `SYSTEM_ACCOUNT_PROTECTED`).
- **INV-4**: real accounts ⇒ exactamente una moneda en `open`; `ensureAcceptsCurrency`.
- **INV-3 (parcial)**: `ensureOpenOn` valida `openedOn <= date <= closedOn?`.

**Plan TDD.**

1. `open` real con una moneda ⇒ `AccountOpened`; real con >1 moneda lanza; nominal con
   varias monedas permitido.
2. Rehidratación desde historia reconstruye estado (`loadFromHistory` + `apply`).
3. `rename` cambia nombre y conserva raíz; cambio de raíz lanza (INV-14).
4. `rename`/`close` sobre cuenta de sistema lanzan (INV-13).
5. `close` fechado; `ensureOpenOn` fuera de rango lanza (INV-3 parcial); reapertura no
   soportada.
6. `ensureAcceptsCurrency` acepta/rechaza (INV-4).

**Criterios de aceptación.** El agregado emite los tres eventos, rehidrata correctamente y
protege INV-4/13/14 e INV-3 parcial, todo sin infraestructura.

**Dependencias y riesgos.** Depende de EP-1.1/1.2/1.3. Riesgo: propagación de renombre a
descendientes — **se decide que ocurre en la proyección** (§6.3), no en el agregado (el
agregado renombra solo su propio nombre); ver Decisión abierta #7.

---

### EP-1.7 — Agregado `LedgerTransaction`

**Objetivo.** Modelar la transacción como agregado que agrupa postings y protege INV-1
(balanceo cero por moneda) mediante el **componente único** de balanceo (INV-11), INV-2
(≥2 postings) e INV-6 (inmutabilidad económica vs. anotación). Cubre el ciclo
`PENDING → CONFIRMED`, enmienda solo en pendiente, anotación en cualquier estado no
`VOIDED`, anulación de pendientes y reversa de confirmadas.

**Archivos a crear.**

- `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.ts` (+ spec)
- `apps/ledger/src/transactions/domain/transaction/transaction-status.ts` (enum app-layer: `PENDING`/`CONFIRMED`/`VOIDED`)
- `apps/ledger/src/transactions/domain/transaction/events/` — `transaction-recorded`, `transaction-amended`, `transaction-annotated`, `transaction-confirmed`, `transaction-voided`, `transaction-reversed` `.event.ts`
- `apps/ledger/src/transactions/domain/balance/balance-rule.ts` (puerto/base, **INV-11**)
- `apps/ledger/src/transactions/domain/balance/zero-sum-balance-rule.ts` (+ spec)
- `apps/ledger/src/transactions/domain/transaction/transaction.repository.ts` (puerto)
- `apps/ledger/src/transactions/domain/transaction/exceptions/transaction.exception.ts`

**Firmas clave.**

```ts
/**
 * The single balancing component of the domain (INV-11). v1 balances at nominal
 * value: for every currency present, the signed sum of posting amounts must be
 * exactly zero (INV-1). Extended at cost for lots later (§9.2) without touching
 * callers.
 */
export abstract class BalanceRule {
  abstract ensureBalanced(postings: readonly PostingLine[]): void;   // throws UnbalancedTransactionException
}

export class LedgerTransaction extends AggregateRoot<string> {
  private status!: TransactionStatus;
  private postings!: readonly PostingLine[];
  private date!: LedgerDate;
  // annotative: payee, description, invoiceUrl, tags, metadata

  /** Records a transaction. Enforces INV-2 (>=2 postings) and INV-1 via BalanceRule. */
  static record(args: RecordTransactionArgs, balance: BalanceRule, idGen: IdGenerator): LedgerTransaction;

  /** Economic amendment — only while PENDING (INV-6). Re-checks INV-1/INV-2. */
  amend(postings: readonly PostingLine[], date: LedgerDate, balance: BalanceRule): void;

  /** Annotative change — allowed in any non-VOIDED state (INV-6). Never touches postings. */
  annotate(annotations: TransactionAnnotations): void;

  /** PENDING -> CONFIRMED; freezes postings (confirmed_at). */
  confirm(clock: Clock): void;

  /** Only PENDING -> VOIDED, with reason. */
  void(reason: string): void;

  /**
   * CONFIRMED only. Emits TransactionReversed on this aggregate and returns a
   * ReversalPlan the handler uses to record the linked reversing transaction
   * (metadata.reverses_id), keeping a single audited write path (§3.4).
   */
  reverse(reversalId: string, clock: Clock): ReversalPlan;

  protected apply(event: DomainEvent): void;
}

export type RecordTransactionArgs = {
  readonly userId: string;
  readonly date: LedgerDate;
  readonly payee: Nullable<Payee>;
  readonly description: string;
  readonly postings: readonly PostingLine[];
  readonly initialStatus: TransactionStatus;   // PENDING | CONFIRMED (RF-3)
  readonly invoiceUrl: Nullable<string>;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
};
```

**Invariantes reforzadas.**

- **INV-1 (vía INV-11)**: todo `record`/`amend` invoca `BalanceRule.ensureBalanced`; el
  balanceo es **por moneda** y exacto (sin tolerancia, §2.7.1). Un único componente.
- **INV-2**: `record`/`amend` exigen `postings.length >= 2`.
- **INV-6**: `amend` lanza `ImmutableTransactionException` (code `IMMUTABLE_TRANSACTION`) si
  el estado no es `PENDING`; `annotate` permitido salvo `VOIDED`; `void` solo `PENDING`;
  `reverse` solo `CONFIRMED`.

**Plan TDD.**

1. **Balanceo (INV-1/INV-11)** en `zero-sum-balance-rule.spec.ts`: suma cero por moneda pasa;
   desbalance en una moneda lanza; **multi-moneda** balanceada por moneda pasa; multi-moneda
   con una moneda descuadrada lanza.
2. `record` con <2 postings lanza (INV-2); con status inicial `PENDING`/`CONFIRMED` (RF-3).
3. `amend` en `PENDING` re-balancea; `amend` en `CONFIRMED`/`VOIDED` lanza (INV-6).
4. `annotate` en `PENDING` y `CONFIRMED` OK; en `VOIDED` lanza (INV-6).
5. `confirm`: `PENDING → CONFIRMED`; doble `confirm` lanza; `confirm` de `VOIDED` lanza.
6. `void`: solo `PENDING`; `void` de `CONFIRMED` lanza.
7. `reverse`: solo `CONFIRMED`; produce `TransactionReversed` + `ReversalPlan` con
   `reverses_id` y postings invertidos; reversa de `PENDING` lanza.
8. Rehidratación completa del ciclo de vida desde historia.

**Criterios de aceptación.** El agregado cubre los 6 eventos del catálogo (§3.4), protege
INV-1/2/6, y el balanceo vive en `BalanceRule` (un solo sitio, INV-11) probado en aislamiento.

**Dependencias y riesgos.** Depende de EP-1.1/1.2/1.3/1.6. Riesgo: la reversa cruza dos
agregados (original + reversing txn); se resuelve con `ReversalPlan` orquestado por el
handler (EP-1.8), no por el agregado. Riesgo: dónde vive `derived_kind` — **no** en el
agregado (necesita tipos de cuenta); se deriva en la proyección (EP-1.10).

---

### EP-1.8 — Command bus + políticas transversales + handlers núcleo

**Objetivo.** Implementar el command bus con las políticas transversales
(idempotencia por `external_ref`, contexto autenticado, concurrencia optimista) y los
handlers núcleo: `InitializeLedger`, `OpenAccount`, `RecordTransaction`, `ConfirmTransaction`,
`AmendPendingTransaction`, `AnnotateTransaction`, `VoidPendingTransaction`,
`ReverseConfirmedTransaction`. Un command retorna solo identificadores + posición de stream
(RNF-10), nunca lecturas.

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/application/command-bus/command.ts` (base + `AuthContext`)
- `apps/ledger/src/shared-kernel/application/command-bus/command-handler.ts` (base abstracta)
- `apps/ledger/src/shared-kernel/application/command-bus/command-bus.ts` (puerto + impl core)
- `apps/ledger/src/shared-kernel/application/command-bus/policies/` — `idempotency.policy.ts`, `authenticated-context.policy.ts`, `optimistic-concurrency.policy.ts`
- `apps/ledger/src/shared-kernel/application/command-bus/command-result.type.ts`
- `apps/ledger/src/ledger/application/initialize-ledger/*` (handler + args + spec)
- `apps/ledger/src/accounts/application/open-account/*`
- `apps/ledger/src/transactions/application/record-transaction/*`
- `apps/ledger/src/transactions/application/{confirm,amend,annotate,void,reverse}-transaction/*`
- `apps/ledger/src/accounts/application/account-validation.service.ts` (INV-3/INV-4 cruzado contra `account_tree`)

**Firmas clave.**

```ts
/** Authenticated provenance every command carries (RF-26, RF-12). Presence is mandatory. */
export type AuthContext = {
  readonly userId: string;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;   // idempotency key (RF-11)
};

export abstract class Command { abstract readonly commandType: string; }

/** A command returns only ids + stream position + domain errors (RNF-10). Never read models. */
export type CommandResult = {
  readonly aggregateId: string;
  readonly streamPosition: bigint;
  readonly idempotentReplay: boolean;
};

export abstract class CommandHandler<TCommand extends Command> {
  abstract execute(command: TCommand, ctx: AuthContext): Promise<CommandResult>;
}

/** Middleware chain applied around every handler. */
export abstract class CommandPolicy {
  abstract handle(command: Command, ctx: AuthContext, next: () => Promise<CommandResult>): Promise<CommandResult>;
}
```

Políticas (orden de aplicación):

1. **`AuthenticatedContextPolicy`** (RF-26): rechaza sin `userId`/`clientId` válidos
   (`MissingAuthContextException`) antes de tocar el dominio.
2. **`IdempotencyPolicy`** (INV-10): si `ctx.externalRef` existe, consulta
   `EventStore.findByExternalRef`; si hay ancla previa, **corta** y devuelve el
   `CommandResult` original (`idempotentReplay: true`) sin ejecutar el handler.
3. **`OptimisticConcurrencyPolicy`** (INV-7): traduce `ConcurrencyConflictException` a error
   de dominio estable (`CONCURRENCY_CONFLICT`); opción de un reintento acotado para commands
   idempotentes por naturaleza.

`InitializeLedger` (INV-13, RF-2): crea `Equity:OpeningBalances` y `Equity:Adjustments` como
cuentas de sistema (`isSystem: true`) + registra `presentation_currency`/`timezone`
(`LedgerInitialized`). `RecordTransaction`/`Confirm`/`Amend` usan `AccountValidationService`
para INV-3/INV-4 contra `account_tree` (§3.5, consistencia relajada; el fallo degrada a
discrepancia, nunca a corrupción). `ReverseConfirmedTransaction` orquesta el `ReversalPlan`:
`TransactionReversed` sobre la original + `TransactionRecorded`(+`Confirmed`) de la reversa,
en **un único append atómico** con `external_ref` en el evento ancla.

**Invariantes reforzadas.** INV-10 (policy), INV-7 (policy + append), INV-13 (InitializeLedger
+ Account), INV-3/INV-4 (AccountValidationService), RNF-10 (result sin lecturas), INV-9
(userId propagado a todo evento), RNF-12 (las trazas/metrics viven en decoradores del bus,
no en el dominio).

**Plan TDD.** (todo con `InMemoryEventStore` + Clock/IdGenerator deterministas)

1. `IdempotencyPolicy`: mismo `external_ref` dos veces ⇒ un solo conjunto de eventos, segundo
   `CommandResult.idempotentReplay = true`.
2. `AuthenticatedContextPolicy`: sin `userId`/`clientId` ⇒ rechazo.
3. `OptimisticConcurrencyPolicy`: conflicto ⇒ error `CONCURRENCY_CONFLICT`.
4. `InitializeLedger`: crea exactamente las dos cuentas técnicas de sistema y `LedgerInitialized`;
   re-inicializar es idempotente/rechazado.
5. `OpenAccount`: feliz + colisión de nombre (`NAME_COLLISION`) vía account_tree.
6. `RecordTransaction`: balanceada `PENDING`/`CONFIRMED`; desbalanceada ⇒ `UNBALANCED_TRANSACTION`;
   cuenta cerrada ⇒ `ACCOUNT_CLOSED`; moneda no permitida ⇒ `CURRENCY_NOT_ALLOWED`.
7. `Confirm`/`Amend`/`Annotate`/`Void`: transiciones válidas e inválidas (INV-6).
8. `Reverse`: emite los eventos vinculados en un append atómico; `reverses_id` presente.
9. **Idempotencia de command multi-evento** (`Reverse`): reintento con mismo `external_ref`
   no duplica la reversa (valida la decisión anchor-only).

**Criterios de aceptación.** Los 8 handlers funcionan end-to-end sobre in-memory; políticas
verificadas; errores con **códigos estables** (RF-14). Se puede inicializar un ledger, abrir
cuentas y registrar/confirmar transacciones balanceadas por código.

**Dependencias y riesgos.** Depende de EP-1.6/1.7 y de `account_tree` (EP-1.10) para
validación cruzada ⇒ orden recomendado: proyector `account_tree` antes de cerrar los handlers
de transacción. Riesgo principal: la **decisión anchor-only de `external_ref`** (EP-1.3).

---

### EP-1.9 — Puerto `ReadModelStore` + `ProjectionDispatcher`

**Objetivo.** Definir el puerto de escritura de read models (solo projectors, RNF-10), la
base `Projector` y el `ProjectionDispatcher` con sus **dos modos con el mismo código de
projector**: síncrono (en la transacción del command, para vistas críticas) y asíncrono
(poller con checkpoint). El modo es configuración por proyección, no una bifurcación del
núcleo (§3.8).

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/application/projection/read-model-store.ts` (puerto)
- `apps/ledger/src/shared-kernel/application/projection/projector.ts` (base)
- `apps/ledger/src/shared-kernel/application/projection/projection-dispatcher.ts` (puerto)
- `apps/ledger/src/shared-kernel/application/projection/projection-checkpoint.repository.ts` (puerto)
- `apps/ledger/src/shared-kernel/infrastructure/adapters/read-model-store/{in-memory,postgres}/`
- `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/synchronous-dispatcher.ts` (misma tx del command)
- `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/polling-dispatcher.ts` (poller con checkpoint, patrón `@Cron` de `apps/finances/.../outbox-relay.scheduler.ts:23`)
- `apps/ledger/src/shared-kernel/infrastructure/testing/read-model-store.contract.ts`

**Firmas clave.**

```ts
/** Read-model persistence port. No business logic; only projectors write (RNF-10). */
export abstract class ReadModelStore {
  abstract upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>;
  abstract delete(table: string, key: ReadModelKey): Promise<void>;
  abstract query<TRow>(table: string, criteria: Criteria): Promise<TRow[]>;   // reuses @shared Criteria
  abstract truncate(table: string): Promise<void>;                            // rebuild (RNF-5)
}

/**
 * Projector: pure event -> view mapping (core code, §3.7). The SAME instance
 * runs synchronously (command tx) or asynchronously (poller); it never knows
 * which. It declares which event types it consumes.
 */
export abstract class Projector {
  abstract readonly name: string;                    // 'account_tree'
  abstract readonly consumes: readonly string[];     // event_type list
  abstract project(event: StoredEvent, store: ReadModelStore): Promise<void>;
}

/** Drives projectors. Mode (sync/async) is adapter configuration per projection. */
export abstract class ProjectionDispatcher {
  abstract dispatch(events: readonly StoredEvent[]): Promise<void>;   // sync: in-tx; async: from checkpoint
}

export abstract class ProjectionCheckpointRepository {
  abstract lastPosition(projectionName: string): Promise<bigint>;
  abstract advance(projectionName: string, position: bigint): Promise<void>;
}
```

**Invariantes reforzadas.** RNF-10 (solo projectors escriben), RNF-5 (`truncate` + checkpoint
habilitan rebuild), RNF-9 (dispatcher síncrono en la tx del command ⇒ read-your-writes),
RNF-12 (lag = posición global − checkpoint, expuesto como métrica por el poller).

**Plan TDD.**

1. `read-model-store.contract.ts`: upsert/delete/query/truncate idénticos in-memory y
   Postgres (misma técnica de contract tests que el event store).
2. `SynchronousDispatcher`: proyecta en la misma unidad de trabajo; si el projector falla, la
   tx del command revierte (atomicidad conjunta event+proyección crítica).
3. `PollingDispatcher`: avanza checkpoint; reprocesa desde checkpoint sin duplicar (upsert
   idempotente por clave); calcula lag.
4. **Mismo projector, ambos modos**: un projector de prueba produce el mismo estado final
   corrido síncrono vs. por poller.

**Criterios de aceptación.** Un projector corre sin cambios en ambos modos; el checkpoint
persiste y permite catch-up; el store solo se escribe vía projectors.

**Dependencias y riesgos.** Depende de EP-1.5 (checkpoints en la misma DB). Riesgo:
reentrancia del poller (dos ticks solapados); mitigación: `FOR UPDATE SKIP LOCKED` /
checkpoint por proyección (patrón `claimPendingBatch` del outbox de finances).

---

### EP-1.10 — Proyectores `account_tree`, `transaction_list` (+`proj_postings`), `account_balances` + derivador `derived_kind`

**Objetivo.** Implementar los tres proyectores núcleo de v1 y el servicio de dominio que
deriva `derived_kind` (RF-4). Estos son la superficie de lectura sobre la que operan el query
bus (EP-1.11) y la validación cruzada de los handlers (EP-1.8).

**Archivos a crear.**

- `apps/ledger/src/accounts/infrastructure/projections/account-tree.projector.ts` (+ spec)
- `apps/ledger/src/transactions/infrastructure/projections/transaction-list.projector.ts` (+ spec) (escribe `proj_transactions` + `proj_postings`)
- `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.ts` (+ spec)
- `apps/ledger/src/transactions/domain/derivation/derived-kind.ts` (enum: `EXPENSE`/`INCOME`/`TRANSFER`/`COMPOUND`)
- `apps/ledger/src/transactions/domain/derivation/transaction-kind.deriver.ts` (servicio de dominio, RF-4) (+ spec)
- `apps/ledger/src/database/migrations/1790000000003-CreateCoreProjections.ts` (proj_accounts, proj_transactions, proj_postings, proj_balances — apéndice A)

**Detalles.**

- **`account_tree`** ← `AccountOpened`/`AccountRenamed`/`AccountClosed`. En `AccountRenamed`
  actualiza `proj_accounts.name` de la cuenta **y el prefijo de todas sus descendientes**
  (§6.3) — única proyección afectada por el renombre (los postings referencian `account_id`).
- **`transaction_list`** ← `Transaction*` / `TransfersMerged`. Escribe `proj_transactions`
  (desnormalizada, incluye `payee`, `derived_kind`, `reverses_id`) y `proj_postings` (una
  fila por posting, `NUMERIC(20,6)`, `status` denormalizado). `derived_kind` se calcula con
  `TransactionKindDeriver` leyendo tipos de cuenta de `account_tree`.
- **`account_balances`** ← `TransactionConfirmed`/`Reversed`/`Voided` y pendientes por
  separado (`confirmed_amount` vs `pending_amount`). Sirve saldos por cuenta+moneda y metas.

```ts
/**
 * Derives the presentational kind from the account types touched (RF-4):
 * any EXPENSES -> EXPENSE; any INCOME -> INCOME; only ASSETS/LIABILITIES ->
 * TRANSFER; anything else -> COMPOUND. Never throws (§9.4.4).
 */
export class TransactionKindDeriver {
  derive(accountTypes: readonly AccountType[]): DerivedKind;
}
```

**Invariantes reforzadas.** INV-5 (los saldos son proyección; ningún command escribe saldos —
`account_balances` es el único productor), RF-4 (`COMPOUND` nunca es error), §2.1.1/§6.3
(propagación de renombre solo en proyección).

**Plan TDD.**

1. `transaction-kind.deriver.spec.ts`: los cuatro casos + combinación desconocida ⇒
   `COMPOUND` (nunca lanza).
2. `account-tree.projector.spec.ts`: open→row; rename propaga prefijo a descendientes;
   close marca `closed_on`.
3. `transaction-list.projector.spec.ts`: record/amend/annotate/confirm/void/reverse reflejan
   estado y postings; `derived_kind` correcto; `reverses_id` en la reversa.
4. `account-balances.projector.spec.ts`: confirmadas mueven `confirmed_amount`; pendientes
   `pending_amount`; reversa netea; multi-moneda mantiene filas separadas por moneda.
5. **Replay**: proyectar el mismo stream dos veces (rebuild) produce el mismo estado
   (idempotencia por clave) — enlaza con EP-1.12.

**Criterios de aceptación.** Las tres proyecciones se materializan por dispatch síncrono y
por replay; `derived_kind` correcto; renombre propaga en `account_tree` sin tocar otras
proyecciones.

**Dependencias y riesgos.** Depende de EP-1.9 y EP-1.6/1.7. Riesgo: orden de dependencia
`transaction_list` → `account_tree` (necesita tipos de cuenta para `derived_kind`);
mitigación: proyectar `account_tree` primero, y tratar cuenta ausente como `COMPOUND`
temporal reconciliado en rebuild.

---

### EP-1.11 — Query bus + query handlers

**Objetivo.** Exponer el lado de lectura sobre las proyecciones vía un query bus, con
handlers que usan el patrón `Criteria` de `@shared`. Sin lógica de dominio, sin acceso al
event store, sin efectos secundarios (RNF-10).

**Archivos a crear.**

- `apps/ledger/src/shared-kernel/application/query-bus/query.ts` (base)
- `apps/ledger/src/shared-kernel/application/query-bus/query-handler.ts` (base abstracta)
- `apps/ledger/src/shared-kernel/application/query-bus/query-bus.ts`
- `apps/ledger/src/accounts/application/queries/get-account-tree/*`
- `apps/ledger/src/accounts/application/queries/get-account-balance/*`
- `apps/ledger/src/transactions/application/queries/list-transactions/*` (filtros: cuenta, período, estado, `derived_kind`, **payee**, `client_id`; paginación — RF-13)
- Criteria por proyección (siguiendo `apps/finances/src/.../criteria/*`): `transaction-field.type.ts`, `transaction-listing.criteria.ts`, etc.

**Firmas clave.**

```ts
export abstract class Query { abstract readonly queryType: string; }

export abstract class QueryHandler<TQuery extends Query, TResult> {
  abstract execute(query: TQuery, ctx: AuthContext): Promise<TResult>;   // reads only from ReadModelStore
}
```

`ListTransactionsQuery` construye un `Criteria<TransactionField>` (filtros por payee,
período, estado, `derived_kind`, `client_id`, paginación) — mismo patrón que
`apps/finances/src/movement/domain/movement/criteria/movement-listing.criteria.ts`.

**Invariantes reforzadas.** RNF-10 (queries solo desde read models, sin efectos), INV-9
(todo filtro anclado a `userId` del contexto; ninguna query cruza usuarios), RNF-9 (el
cliente puede leer su propia escritura tras el dispatch síncrono).

**Plan TDD.**

1. `list-transactions` con filtros combinados (payee + período + estado) y paginación.
2. Aislamiento por usuario: un usuario nunca ve filas de otro (INV-9).
3. `get-account-tree` (árbol/plano) y `get-account-balance` (confirmado vs pendiente por
   moneda).
4. Un query handler no escribe nada (verificación de no-efectos).

**Criterios de aceptación.** Las tres queries responden desde proyecciones con `Criteria`,
respetan INV-9 y no tocan el event store.

**Dependencias y riesgos.** Depende de EP-1.10 y del `Criteria` de `@shared`. Riesgo bajo:
reutiliza infra existente (`typeorm-criteria.converter.ts`).

---

### EP-1.12 — Tooling de rebuild/replay + verificación stream vs proyección (RNF-5)

**Objetivo.** Proveer el tooling para reconstruir cualquier proyección desde cero por replay
del stream y **verificar consistencia** entre el stream y las proyecciones (los saldos
derivados del stream deben igualar `proj_balances`). Es la garantía operativa de RNF-5 y el
cierre de la épica.

**Archivos a crear.**

- `apps/ledger/src/read-side/rebuild/projection-rebuilder.ts` (+ spec)
- `apps/ledger/src/read-side/rebuild/consistency-verifier.ts` (+ spec)
- `apps/ledger/src/read-side/rebuild/rebuild.command.ts` (CLI/`nestjs-command` o script de nx) — adaptador driving
- (opcional) `apps/ledger/src/read-side/rebuild/stream-balance.calculator.ts` (recalcula saldos leyendo `readAll`, sin proyección)

**Firmas clave.**

```ts
/**
 * Rebuilds one or all projections by replay (RNF-5): truncates the read model
 * and its checkpoint, then re-projects the whole stream via readAll from 0.
 */
export class ProjectionRebuilder {
  constructor(
    private readonly eventStore: EventStore,
    private readonly registry: EventRegistry,
    private readonly store: ReadModelStore,
    private readonly checkpoints: ProjectionCheckpointRepository,
    private readonly projectors: readonly Projector[],
  ) {}

  async rebuild(projectionName: string): Promise<RebuildReport>;
  async rebuildAll(): Promise<readonly RebuildReport[]>;
}

/**
 * Verifies the read side against the source of truth: recomputes balances from
 * the stream (readAll) and compares them to proj_balances, reporting drift.
 */
export class ConsistencyVerifier {
  async verifyBalances(userId: string): Promise<VerificationReport>;   // exact decimal comparison (INV-8)
}
```

**Invariantes reforzadas.** RNF-5 (reconstruibilidad demostrable), INV-12 (el rebuild **lee**
el stream, jamás lo edita), INV-8 (comparación decimal exacta, sin tolerancia float).

**Plan TDD.**

1. `projection-rebuilder.spec.ts`: dado un stream, `rebuild` produce el mismo estado que el
   dispatch incremental; `truncate` + replay es idempotente; el checkpoint queda en la
   última posición.
2. `consistency-verifier.spec.ts`: stream y proyección coinciden ⇒ report OK; una fila de
   balance corrupta a mano ⇒ el verifier la detecta (drift exacto).
3. Rebuild parcial de una sola proyección no afecta las demás.

**Criterios de aceptación.** Se puede reconstruir cualquier proyección por replay y verificar
consistencia stream↔proyección con diferencia exacta cero. **Cierre de EP-1**: inicializar
ledger, abrir cuentas, registrar/confirmar transacciones balanceadas end-to-end sobre
Postgres, y reconstruir proyecciones por replay — todo cubierto por contract tests idénticos
in-memory/PG.

**Dependencias y riesgos.** Depende de EP-1.5/1.9/1.10. Riesgo: rebuild de grandes streams;
fuera de alcance en v1 (sin snapshots, §6.3), aceptable dado agregados de vida corta.

---

## Apéndice A — DDL propuesto (adaptado de §6.1/§6.2)

Migraciones bajo `apps/ledger/src/database/migrations/` (estilo `MigrationInterface` como
`apps/finances/src/database/migrations/1784073600021-CreateOutboxEventsTable.ts`). Fase de
desarrollo sin datos: el esquema se crea desde cero. **Sin enums de DB**: columnas
enum-like como `text`.

### A.1 — `event_store` (1790000000001)

```sql
CREATE TABLE event_store (
    global_position  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id         UUID NOT NULL UNIQUE,
    user_id          UUID NOT NULL,
    aggregate_type   TEXT NOT NULL,          -- 'Account', 'LedgerTransaction', ...
    aggregate_id     UUID NOT NULL,
    sequence         BIGINT NOT NULL,        -- version within the aggregate (1-based)
    event_type       TEXT NOT NULL,          -- 'TransactionRecorded', ...
    schema_version   SMALLINT NOT NULL DEFAULT 1,
    client_id        TEXT NOT NULL,          -- opaque provenance metadata
    external_ref     TEXT,                   -- client idempotency key (ANCHOR event only)
    payload          JSONB NOT NULL,         -- amounts as decimal strings (RNF-2)
    occurred_at      TIMESTAMPTZ NOT NULL,
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Optimistic concurrency per aggregate (INV-7)
    UNIQUE (aggregate_id, sequence)
);

-- Idempotency (INV-10): one command per external reference per user.
-- external_ref is stamped only on each command's anchor event, so this unique
-- index holds even for multi-event commands (merge, reverse, resolve).
CREATE UNIQUE INDEX idx_event_external_ref
    ON event_store (user_id, external_ref)
    WHERE external_ref IS NOT NULL;

CREATE INDEX idx_event_aggregate ON event_store (aggregate_id, sequence);
CREATE INDEX idx_event_user      ON event_store (user_id, global_position);

-- INV-12: append-only enforced at the storage level (defense in depth, RNF-1)
CREATE OR REPLACE FUNCTION reject_event_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'event_store is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_store_immutable
    BEFORE UPDATE OR DELETE ON event_store
    FOR EACH ROW EXECUTE FUNCTION reject_event_mutation();
```

`down()`: `DROP TRIGGER` → `DROP FUNCTION` → `DROP INDEX` (×3) → `DROP TABLE`.

### A.2 — `projection_checkpoints` (1790000000002)

```sql
CREATE TABLE projection_checkpoints (
    projection_name  TEXT PRIMARY KEY,
    last_position    BIGINT NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### A.3 — Proyecciones núcleo (1790000000003)

`proj_accounts`, `proj_transactions`, `proj_postings`, `proj_balances` exactamente como §6.2
(tipos `NUMERIC(20,6)` para montos; columnas enum-like como `TEXT`; constraints de negocio
mínimos — la verdad vive en el stream, §6.3), más los índices:

```sql
CREATE INDEX idx_proj_postings_account ON proj_postings (account_id, date);
CREATE INDEX idx_proj_txn_user_date    ON proj_transactions (user_id, date);
CREATE INDEX idx_proj_txn_payee        ON proj_transactions (user_id, payee);
```

(Se omiten aquí `proj_assertions`, `proj_ledger_settings` completos y las proyecciones de
referencia/producto: entran en EP-3/EP-4. `LedgerInitialized` de EP-1.8 requiere una versión
mínima de `proj_ledger_settings` con `user_id`, `presentation_currency`, `timezone`,
`initialized_at`.)

---

## Apéndice B — Orden recomendado de implementación dentro de EP-1

El orden respeta las dependencias reales (no el numérico estricto):

1. **EP-1.1** value objects → **EP-1.2** envelope/serialización → **EP-1.3** puertos
   `EventStore`/`Clock`/`IdGenerator` (contrato). *(Base del hexágono.)*
2. **EP-1.4** in-memory + contract tests. *(Desbloquea probar todo el núcleo sin DB.)*
3. **EP-1.6** `Account` y **EP-1.7** `LedgerTransaction` (con `BalanceRule`). *(Dominio puro,
   sobre in-memory.)*
4. **EP-1.9** `ReadModelStore`/`ProjectionDispatcher` (in-memory primero) → **EP-1.10**
   proyector `account_tree` + `TransactionKindDeriver`. *(Necesarios para la validación
   cruzada de los handlers.)*
5. **EP-1.8** command bus + políticas + handlers (usa `account_tree` para INV-3/INV-4).
6. **EP-1.10** (resto): `transaction_list`/`proj_postings` y `account_balances`.
7. **EP-1.11** query bus + handlers.
8. **EP-1.5** `PostgresEventStore` + adaptador Postgres de `ReadModelStore` (reejecuta los
   contract tests de EP-1.4/EP-1.9 contra PG). *(Se puede adelantar tras EP-1.4 si se quiere
   validar el esquema temprano.)*
9. **EP-1.12** rebuild/replay + verificación de consistencia. *(Cierre de la épica.)*

Regla: el núcleo (pasos 1, 3–7) se completa sobre adaptadores in-memory; Postgres (paso 8)
solo debe **pasar los mismos contract tests**, nunca introducir lógica de dominio.

---

## Apéndice C — Decisiones abiertas para el usuario

1. **Idempotencia de commands multi-evento vs. `external_ref` único (crítica, bloquea
   EP-1.3/1.8).** El índice `idx_event_external_ref` de §6.1 admite un solo evento por
   `external_ref`, pero `MergePendingTransfers`, `ResolveDiscrepancy` y la reversa emiten
   varios eventos por command. **Propuesta**: *anchor-only stamping* — `external_ref` se
   graba solo en el evento ancla (el primero del command) y la idempotencia se resuelve en el
   bus vía `EventStore.findByExternalRef` (short-circuit), con el índice como defensa en
   profundidad. Alternativa: añadir `command_id` al esquema y una tabla `command_dedup`.
   *Requiere confirmación antes de EP-1.8.*
2. **Pregunta abierta #7 (propagación de renombre).** ¿`AccountRenamed` propaga a
   descendientes en el mismo command (un evento sobre la cuenta + rebuild de proyección) o
   como eventos individuales por cuenta? **Propuesta**: un único `AccountRenamed` sobre la
   cuenta renombrada; la propagación del prefijo a descendientes ocurre **en la proyección
   `account_tree`** (§6.3), no en el stream (los postings referencian `account_id`, así que
   nada económico cambia). Ventaja: renombre barato y atómico; los descendientes no emiten
   eventos. *Confirmar que no se requiere un evento por descendiente para auditoría.*
3. **Modo de despacho por proyección (§8.1 pregunta #4, acotado a EP-1).** Propuesta:
   `transaction_list`, `proj_postings`, `account_balances` **síncronas** (en la tx del
   command, RNF-9 gratis); el resto (EP-3/EP-4) asíncronas. `account_tree` síncrona por ser
   dependencia de validación. *Confirmar sesgo síncrono.*
4. **Fuente de `minor_units` en EP-1.** `CurrencyRegistered` es EP-4; propuesta de
   `CurrencyCatalog` seed (COP=0, USD=2) como puerto temporal. *Confirmar el set de monedas
   semilla.*
5. **`LedgerDate`**: fecha contable plana sin zona (RNF-7). *Confirmar representación
   (string `YYYY-MM-DD` vs. tipo propio) para payloads y `DATE` en proyección.*
6. **Herramienta CLI de rebuild (EP-1.12)**: `nest-commander`/script de nx. *Elegir mecanismo
   de ejecución del adaptador driving.*

---

## Apéndice D — Estimación de esfuerzo (S/M/L)

| Subtarea | Esfuerzo | Notas |
|---|---|---|
| EP-1.1 Value objects | **M** | `AccountName` (parseo/jerarquía/reparent) concentra el trabajo; resto S. |
| EP-1.2 Envelope + serialización | **S/M** | Directo; el upcasting (RNF-6) añade algo. |
| EP-1.3 Puerto `EventStore` + Clock/IdGen | **M** | Diseño del contrato + semántica de idempotencia (decisión C.1). |
| EP-1.4 In-memory + contract tests | **M** | La suite de contract tests es el activo reutilizable clave. |
| EP-1.5 `PostgresEventStore` | **L** | SQL, trigger, traducción de errores, DB de test, `bigint`. |
| EP-1.6 Agregado `Account` | **M** | Base `AggregateRoot` + INV-13/14/4/3-parcial. |
| EP-1.7 Agregado `LedgerTransaction` | **L** | Ciclo de vida completo + `BalanceRule` (INV-11) + reversa cross-aggregate. |
| EP-1.8 Command bus + políticas + handlers | **L** | 8 handlers + 3 políticas + validación cruzada + orquestación de reversa. |
| EP-1.9 `ReadModelStore` + `ProjectionDispatcher` | **L** | Doble adaptador + dos modos con mismo projector + checkpoints/poller. |
| EP-1.10 Proyectores + `derived_kind` | **L** | 3 proyectores (incl. propagación de renombre y balances confirmado/pendiente). |
| EP-1.11 Query bus + handlers | **M** | Reutiliza `Criteria` de `@shared`. |
| EP-1.12 Rebuild/replay + verificación | **M** | Rebuilder + verifier; sin snapshots (v1). |

Total aproximado: **6× L, 5× M, 1× S/M**. EP-1 es la épica más grande y de mayor riesgo del
roadmap; el camino crítico es EP-1.7 → EP-1.8 → EP-1.9/1.10.
