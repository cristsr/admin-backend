# context: hu-0002

> Generado por /scan. Input para /design y /plan.
> No editar manualmente — re-ejecutar /scan si el contexto cambió.

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** un puerto `EventStore` con semántica completa (concurrencia optimista, idempotencia
por `external_ref`, orden por posición global, append atómico) y un adaptador in-memory que lo
satisfaga por completo, junto con una suite de contract tests reutilizable
**Para** poder construir y testear el resto del núcleo (agregados, command bus) sin
infraestructura real, y garantizar que cualquier adaptador futuro (Postgres) sea sustituible
sin cambiar el comportamiento observable (RNF-11)

Corresponde a **EP-1.3 + EP-1.4** del roadmap del ledger.

## Microservicios afectados

- `apps/ledger`

---

## ⚠️ Naturaleza de esta historia: verificación, no build

`hu-0001..hu-0008` no piden construir desde cero: la épica EP-1 se implementó de una sola vez
tomando la épica completa como unidad. Estas historias trocean cada épica en piezas auditables
**después de que el código ya existe**, para comprobar a nivel de AC qué quedó completo y qué
falta — no para generar artefactos nuevos.

El branch actual (`feat/core`) ya contiene los commits `merge(ledger): integrate EP-1/EP-2/EP-3
into feat/core` y `feat(ledger): implement EP-4.2/4.3/4.4/4.5/4.6 + EP-5`.

Todo el código de EP-1.3 y EP-1.4 (el alcance de esta historia) **ya está implementado en su
totalidad**, incluyendo el adaptador `PostgresEventStore` (EP-1.5) que se construyó por
adelantado.

---

## Checklist AC-by-AC

| AC | Descripción | Veredicto | Detalle |
|---|---|---|---|
| AC-1 | `EventStore` puerto con 4 operaciones | ✅ **CUMPLE** | `event-store.ts` (41 líneas): `abstract class EventStore` con `append(stream, expectedVersion, events)`, `load(stream)`, `readAll(fromPosition, limit)`, `findByExternalRef(userId, externalRef)`. Append-only (INV-12), sin métodos de update ni delete. |
| AC-2 | `append` en stream nuevo asigna secuencia y posición | ✅ **CUMPLE** | Contract test lo verifica: `sequence` correlativo (1..n) y `globalPosition` creciente. `InMemoryEventStore` usa `nextPosition` (`bigint`) como contador monotónico global. |
| AC-3 | `load` devuelve historial ordenado; desconocido → `[]` | ✅ **CUMPLE** | Contract test: `history.map(e => e.sequence) === [1]` y `unknown === []`. `InMemoryEventStore` filtra por `userId` + `aggregateId`, ordena por `sequence`. |
| AC-4 | `readAll` ordena estrictamente por posición global, respeta `limit` | ✅ **CUMPLE** | Contract test: `Promise.allSettled` con 3 inserts intercalados → posiciones globales monótonas. `InMemoryEventStore` filtra `> fromPosition`, ordena por `globalPosition`, slicea a `limit`. |
| AC-5 | Concurrencia optimista: rechaza y no persiste nada (INV-7) | ✅ **CUMPLE** | Contract test: `append` con `expectedVersion` desfasado → `ConcurrencyConflictException`. Historial intacto post-rechazo (length 1). Excepción en `event-store.exception.ts` extiende `DomainConflictException`, code `CONCURRENCY_CONFLICT`. |
| AC-6 | Dos appends concurrentes — exactamente uno gana | ✅ **CUMPLE** | Contract test: `Promise.allSettled([append, append])` → exactamente 1 `fulfilled`. Semántica de `expectedVersion`, no race condition real (Node monohilo). |
| AC-7 | Idempotencia por `external_ref` (INV-10) | ✅ **CUMPLE** | Contract test: mismo `externalRef` en dos streams distintos → `DuplicateExternalRefException`. `findByExternalRef` devuelve el evento ancla original (`agg-1`). Excepción code `DUPLICATE_EXTERNAL_REF`. |
| AC-8 | `external_ref` no colisiona entre usuarios distintos (INV-9) | ✅ **CUMPLE** | Contract test: user-1 y user-2 comparten `"ref-1"` sin conflicto. `findByExternalRef(userId, 'ref-9')` → `null`. Scopeado por `userId` tanto en `findByExternalRef` como en la verificación de duplicados. |
| AC-9 | Round-trip del payload decimal sin pérdida | ✅ **CUMPLE** | Contract test: `payload: { amount: '-31900', usd: '7.99' }` → `load` devuelve strings exactos. No hay conversión a `number` en ningún punto. |
| AC-10 | Atomicidad de batch multi-evento: todo o nada | ✅ **CUMPLE** | Contract test: batch con `sequence: 2` duplicado → `ConcurrencyConflictException`, stream sigue con length 1. `InMemoryEventStore` hace read-check-write atómico (monohilo). |
| AC-11 | `append` con lote vacío → no-op | ⚠️ **GAP DE IMPLEMENTACIÓN** | `EnvelopeFactory.build()` puede retornar `[]` cuando `events` está vacío (caso: `aggregate.pullChanges()` vacío en `EventSourcedRepository.save()`). `InMemoryEventStore.append()` **fallaría** con `TypeError` en `stored[stored.length - 1].globalPosition` (índice -1). No hay test de contract para lotes vacíos ni guard temprano en `save()`. |
| AC-12 | `Clock` e `IdGenerator` deterministas para tests | ✅ **CUMPLE** | `FixedClock` (`shared/testing/fixed-clock.ts`): fecha fija, `advanceBy(ms)`. `SequentialIdGenerator` (`shared/testing/sequential-id-generator.ts`): UUIDs secuenciales predecibles. Ambos extienden puertos `Clock`/`IdGenerator` en `shared/domain/ports/`. Usados por toda la suite de contract tests y por `hu-0001`. |
| AC-13 | `EventSourcedRepository` reconstruye y persiste agregados | ✅ **CUMPLE** | `event-sourced.repository.ts` (55 líneas): `load(userId, aggregateId)` → rehidrata vía `EventRegistry.deserialize()` + `rehydrate()`; `save(aggregate, ctx)` → `pullChanges()` + `EnvelopeFactory.build()` + `EventStore.append()`. 4 repositorios concretos lo extienden: `AccountRepository`, `LedgerTransactionRepository`, `LedgerSettingsRepository`, `BalanceAssertionRepository`. |
| AC-14 | `InMemoryEventStore` pasa el 100% de la suite de contract tests | ✅ **CUMPLE** | `in-memory-event-store.spec.ts` (4 líneas): `describeEventStoreContract(async () => new InMemoryEventStore())`. La suite de contract tests (`event-store.contract.ts`, 202 líneas) cubre AC-2 a AC-10 (9 casos). **AC-11 no está cubierto por la suite**. |

**Resumen:** 13/14 AC cumplen. **1 gap real de implementación (AC-11)**: el lote vacío no
está cubierto por la suite de contract tests y el `InMemoryEventStore` fallaría si se invoca
con `events: []`.

---

## apps/ledger

### Estructura relevante

Las raíces de código propias del ledger son dos (no confundir):
- `shared-kernel/` — núcleo de event sourcing: agregados, eventos, puertos (`EventStore`),
  command bus, query bus, proyecciones, `EventSourcedRepository`.
- `shared/` — plataforma técnica: `Money`, `Currency`, puertos (`Clock`, `IdGenerator`),
  `FixedClock`, `SequentialIdGenerator`, `SystemClock`, `UuidIdGenerator`.

### Puerto `EventStore`

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\ports\event-store.ts`

`abstract class EventStore` con 4 operaciones:
```typescript
abstract append(stream: StreamId, expectedVersion: number, events: readonly EventEnvelope[]): Promise<AppendResult>;
abstract load(stream: StreamId): Promise<readonly StoredEvent[]>;
abstract readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>;
abstract findByExternalRef(userId: string, externalRef: string): Promise<Nullable<StoredEvent>>;
```

### Adaptador in-memory

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\event-store\in-memory\in-memory-event-store.ts`

- `class InMemoryEventStore extends EventStore`
- `events: StoredEvent[]` — array en memoria
- `nextPosition = 1n` — contador monotónico `bigint`
- `append()`: verifica `expectedVersion`, secuencias consecutivas, unicidad de `externalRef`;
  asigna `globalPosition`; push atómico.
- `load()`: filtra por `userId + aggregateId`, ordena por `sequence`.
- `readAll(fromPosition, limit)`: filtra `> fromPosition`, ordena por `globalPosition`, slice.
- `findByExternalRef`: búsqueda por `userId + externalRef`.

### Adaptador postgres (EP-1.5, ya construido)

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\adapters\event-store\postgres\postgres-event-store.ts`

- Pasa la **misma** suite de contract tests, garantizando RNF-11.
- Usa `DataSource` de TypeORM, mapea errores de unique-constraint a `ConcurrencyConflictException`/`DuplicateExternalRefException`.
- Row type en `event-store.row.type.ts`.

### Suite de contract tests

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\infrastructure\testing\event-store.contract.ts`

- `describeEventStoreContract(makeStore: MakeEventStore, teardown?)` — suite Jest parametrizada.
- 9 casos que cubren AC-2 a AC-10.
- `MakeEventStore = () => Promise<EventStore>` — cada test crea una instancia fresca.
- Helper `anEnvelope(stream, overrides)` genera envelopes mínimos con UUIDs estables.
- **No cubre AC-11** (lote vacío).

### Excepciones específicas del EventStore

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\exceptions\event-store.exception.ts`

| Excepción | Extiende | Code |
|---|---|---|
| `ConcurrencyConflictException` | `DomainConflictException` | `CONCURRENCY_CONFLICT` |
| `DuplicateExternalRefException` | `DomainConflictException` | `DUPLICATE_EXTERNAL_REF` |

Ambas mapean a HTTP 409 vía `LedgerErrorCodeMapping`.

### Tipos de dominio del event sourcing

| Tipo | Archivo | Definición |
|---|---|---|
| `EventEnvelope` | `...\domain\event\event-envelope.type.ts` | `type` con 12 campos: `eventId`, `userId`, `aggregateType`, `aggregateId`, `sequence`, `eventType`, `schemaVersion`, `clientId`, `externalRef: Nullable<string>`, `payload: EventPayload`, `occurredAt`, `recordedAt` |
| `StoredEvent` | `...\domain\event\stored-event.type.ts` | `EventEnvelope & { globalPosition: bigint }` |
| `StreamId` | `...\domain\event\stream-id.type.ts` | `{ userId, aggregateType, aggregateId }` |
| `AppendResult` | `...\domain\event\append-result.type.ts` | `{ events, version, lastPosition }` |
| `EventPayload` | `...\domain\event\event-payload.type.ts` | `Readonly<Record<string, unknown>>` |

Sin barrel — se importan directamente vía `@ledger/shared-kernel/domain/event/<file>`.

### `EventSourcedRepository`

**Archivo:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\event-sourced.repository.ts`

```typescript
abstract class EventSourcedRepository<TAggregate extends AggregateRoot<string>> {
  abstract aggregateType: string;
  constructor(eventStore: EventStore, registry: EventRegistry, envelopes: EnvelopeFactory);
  abstract rehydrate(id: string, events: DomainEvent[]): TAggregate;
  async load(userId: string, aggregateId: string): Promise<Nullable<TAggregate>>;
  async save(aggregate: TAggregate, ctx: AuthContext): Promise<AppendResult>;
}
```

`save()` hace `pullChanges()` → `EnvelopeFactory.build()` → `EventStore.append()`.
**No tiene guard para `changes.length === 0`** — si el agregado no tiene cambios, delega en
`EventStore.append()` con array vacío, lo que expone el gap de AC-11.

### Puertos Clock / IdGenerator + doubles para tests

| Artefacto | Archivo |
|---|---|
| `Clock` (puerto) | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\ports\clock.ts` |
| `IdGenerator` (puerto) | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\ports\id-generator.ts` |
| `FixedClock` | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\testing\fixed-clock.ts` |
| `SequentialIdGenerator` | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\testing\sequential-id-generator.ts` |
| `SystemClock` (producción) | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\system-clock.ts` |
| `UuidIdGenerator` (producción) | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\uuid-id-generator.ts` |

**Nota de naming:** los doubles se llaman `FixedClock` y `SequentialIdGenerator` en el
código real, no `DeterministicClock` ni `FixedIdGenerator` como nombra la historia.
Semánticamente equivalentes.

### Primitivas de `libs/shared` reutilizadas

- `Nullable<T>` → `D:\Cristian\Nest\admin-back\libs\shared\src\types\nullable.type.ts`
- `DomainException` → `D:\Cristian\Nest\admin-back\libs\shared\src\exceptions\domain.exception.ts`
- `DomainConflictException` → `D:\Cristian\Nest\admin-back\libs\shared\src\exceptions\domain-conflict.exception.ts`
- Barrel → `D:\Cristian\Nest\admin-back\libs\shared\src\index.ts`

### Base de datos

**Migración:** `D:\Cristian\Nest\admin-back\apps\ledger\src\database\migrations\1790000000001-CreateEventStore.ts`

Tabla `event_store` con trigger de inmutabilidad, índices únicos para `external_ref` y
concurrencia. Defensa en profundidad (RNF-1).

### Documentación disponible

- `RESUMEN_EJECUTIVO.md` (raíz) — **no menciona `apps/ledger`**. Gap transversal.
- `ledger-roadmap.md` (raíz) — checklist; EP-1.3/EP-1.4 sin marcar `[x]` pese a estar implementados.
- `especificacion-tecnica-ledger.md` (raíz) — spec v0.7 (818 líneas); §6.1 Event Store, §6.2 Write Model.
- `work/ledger/EP-1-nucleo.md` — plan de diseño original de EP-1.

### Convenciones confirmadas

- Puertos: `abstract class`, nunca `interface` — confirmado en `EventStore`, `Clock`, `IdGenerator`, `EventRegistry`, `CurrencyCatalog`.
- `domain/` y `application/` libres de `@nestjs/*` y `typeorm` (RNF-11).
- Excepciones extienden `DomainConflictException`/`DomainUnprocessableException` con `readonly code: string`.
- Contract tests parametrizados: `describeEventStoreContract(makeStore)` — la misma suite corre contra in-memory y Postgres.
- Anchor-only stamping de `externalRef`: `EnvelopeFactory.build()` estampa solo en el primer evento del batch (`index === 0`).

---

## Gaps detectados

1. **AC-11 — `append` con lote vacío no está implementado ni testeado (real, accionable):**
   Ni la suite de contract tests ni el `InMemoryEventStore` manejan `events: []`. La
   implementación actual fallaría con `TypeError` (acceso a `globalPosition` en índice -1) si
   `EventSourcedRepository.save()` recibe un agregado sin cambios (`pullChanges()` vacío).
   La `Resolución de Ambigüedades` de `hu.md` ya decidió: comportamiento no-op silencioso.
   **Candidato principal para `/plan`.**

2. **Naming divergence (cosmético):** `hu.md` menciona `DeterministicClock` y
   `FixedIdGenerator`; el código real usa `FixedClock` y `SequentialIdGenerator`.
   Decisión de `/design` a ratificar — sin impacto funcional.

3. **`ledger-roadmap.md`** no marca EP-1.3/EP-1.4 como `[x]` — desactualizado.

4. **`RESUMEN_EJECUTIVO.md`** no documenta `apps/ledger` — gap transversal.

**Confirmado sin gap:**
- El código de EP-1.3/EP-1.4 (e incluso EP-1.5 con `PostgresEventStore`) está 100%
  implementado y funcional.
- La suite de contract tests (`describeEventStoreContract`) ya es reutilizable y corre
  contra ambos adaptadores (in-memory y Postgres).
- `InMemoryEventStore` ya pasa la suite de contract tests completa (9/9 casos existentes).
- `PostgresEventStore` también pasa la misma suite (fuera del alcance de esta historia,
  pero confirma RNF-11).
- `EventSourcedRepository` ya está en uso por 4 repositorios concretos (`AccountRepository`,
  `LedgerTransactionRepository`, `LedgerSettingsRepository`, `BalanceAssertionRepository`).
