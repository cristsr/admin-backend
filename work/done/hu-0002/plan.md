# hu-0002: Puerto `EventStore` + adaptador in-memory + contract tests — Plan de Implementación

**Historia:** `work/active/hu-0002/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Cerrar el gap AC-11 (lote vacío → no-op) con guard en InMemoryEventStore + EventSourcedRepository, más test de contract.
**Arquitectura:** Verificación sobre código existente. Se agregan 2 guards (defensa en profundidad) y 1 test case a la suite de contract tests ya implementada. Sin nuevos archivos de producción — solo modificación de 3 archivos existentes + 1 spec nuevo para el repositorio.
**Stack:** NestJS · TypeScript · Jest
**Branch:** `fix/HU-0002-empty-batch-guard`

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-11 | Tarea 1 (contract test), Tarea 2 (InMemoryEventStore guard), Tarea 3 (EventSourcedRepository guard) |
| AC-1 a AC-10 | Ya cubiertos por suite existente — Tarea 4 (verificación de no regresión) |
| AC-12 a AC-14 | Ya cubiertos — Tarea 4 (verificación de no regresión) |

> AC-1 a AC-10 y AC-12 a AC-14 ya estaban implementados y pasando antes de esta historia.
> La suite de contract tests (`describeEventStoreContract`) ya los cubre. Tarea 4 los re-ejecuta
> para confirmar que no hay regresión.

---

### Tarea 0: Preparar rama de trabajo

> Al ejecutar este plan, solicitar al usuario el nombre de la rama antes de continuar.

**Preguntar:** "¿Cuál es el nombre de la rama? (ej: fix/HU-0002-empty-batch-guard)"

**Steps:**

**Step 1: Verificar que la base esté fresca (read-only)**

```bash
git -C . branch --show-current
git -C . status --porcelain
```

Esperado: en `feat/core`, working tree limpio. Preparar la base (`checkout` + `pull`) es trabajo de `/sync`, no de este plan.

**Step 2: Crear rama de trabajo**

```bash
git -C . checkout -b fix/HU-0002-empty-batch-guard
```

Esperado: rama nueva creada y activa.

---

### Tarea 1: Agregar test AC-11 a la suite de contract tests [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared-kernel/infrastructure/testing/event-store.contract.ts`

**Step 1: Agregar el test case**

En `apps/ledger/src/shared-kernel/infrastructure/testing/event-store.contract.ts`, insertar antes del `});` de cierre de `describe('EventStore contract', ...)` (línea ~201):

```typescript
    it('treats an empty batch as a no-op (AC-11)', async () => {
      const stream = streamFor('user-1', 'agg-1');
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);

      const result = await store.append(stream, 1, []);

      expect(result.events).toEqual([]);
      expect(result.version).toBe(1);
      expect(await store.load(stream)).toHaveLength(1);
    });
```

**Step 2: Ejecutar el test del adaptador in-memory y confirmar que falla**

```bash
npx jest --testPathPattern="in-memory-event-store.spec.ts" --no-coverage 2>&1 | Select-String -Pattern "PASS|FAIL|Tests:"
```

Esperado: FAIL — el test nuevo falla. `InMemoryEventStore.append()` intenta acceder a `stored[-1].globalPosition` y lanza `TypeError`.

**Step 3: Agregar guard de lote vacío en InMemoryEventStore**

En `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts`, al inicio del método `append()`, después de la firma (línea ~27):

```typescript
    if (events.length === 0) {
      return { events: [], version: expectedVersion, lastPosition: 0n };
    }
```

Insertarlo entre la declaración de `const current = this.streamEvents(stream);` y el bloque `if (current.length !== expectedVersion)`.

El método completo debe quedar:

```typescript
  async append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult> {
    const current = this.streamEvents(stream);

    if (events.length === 0) {
      return { events: [], version: expectedVersion, lastPosition: 0n };
    }

    if (current.length !== expectedVersion) {
      throw new ConcurrencyConflictException(
        `Expected version ${expectedVersion} for ${stream.aggregateId}, found ${current.length}`,
      );
    }
    // ... resto del método sin cambios
```

**Step 4: Ejecutar el test in-memory y confirmar que pasa**

```bash
npx jest --testPathPattern="in-memory-event-store.spec.ts" --no-coverage 2>&1 | Select-String -Pattern "PASS|FAIL|Tests:"
```

Esperado: PASS — todos los tests del adaptador in-memory pasan, incluyendo el nuevo AC-11.

**Step 5: Agregar el mismo guard en PostgresEventStore**

En `apps/ledger/src/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`, al inicio del método `append()`, misma ubicación:

```typescript
    if (events.length === 0) {
      return { events: [], version: expectedVersion, lastPosition: 0n };
    }
```

> Nota: `PostgresEventStore` es EP-1.5 (fuera del alcance de esta historia según `hu.md`),
> pero comparte la suite de contract tests. Sin este guard, el test de AC-11 fallaría también
> contra Postgres. El cambio es idéntico (3 líneas) y no altera ninguna otra semántica.

---

### Tarea 2: Ejecutar contract test contra ambos adaptadores [X]

**Step 1: Ejecutar ambos specs de EventStore**

```bash
npx jest --testPathPattern="event-store" --no-coverage 2>&1 | Select-String -Pattern "PASS|FAIL|Tests:"
```

Esperado: PASS para ambos — `in-memory-event-store.spec.ts` y `postgres-event-store.spec.ts`.

---

### Tarea 3: Crear spec y agregar guard en EventSourcedRepository [X]

**Archivos:**
- Crear: `apps/ledger/src/shared-kernel/application/event-sourced.repository.spec.ts`
- Modificar: `apps/ledger/src/shared-kernel/application/event-sourced.repository.ts`

**Step 1: Crear el spec**

En `apps/ledger/src/shared-kernel/application/event-sourced.repository.spec.ts`:

```typescript
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { AggregateRoot } from '@ledger/shared-kernel/domain/aggregate/aggregate-root';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { EventSourcedRepository } from './event-sourced.repository';

class TestAggregate extends AggregateRoot<string> {
  apply(_event: DomainEvent): void {}
}

class TestRepository extends EventSourcedRepository<TestAggregate> {
  readonly aggregateType = 'Test';

  constructor(
    eventStore: EventStore,
    registry: EventRegistry,
    envelopes: EnvelopeFactory,
  ) {
    super(eventStore, registry, envelopes);
  }

  rehydrate(_id: string, _events: readonly DomainEvent[]): TestAggregate {
    return new TestAggregate('test-id');
  }
}

describe('EventSourcedRepository', () => {
  let repo: TestRepository;
  let mockStore: jest.Mocked<EventStore>;
  let mockRegistry: jest.Mocked<EventRegistry>;
  let mockEnvelopes: jest.Mocked<EnvelopeFactory>;

  beforeEach(() => {
    mockStore = {
      append: jest.fn(),
      load: jest.fn(),
      readAll: jest.fn(),
      findByExternalRef: jest.fn(),
    } as unknown as jest.Mocked<EventStore>;

    mockRegistry = { register: jest.fn(), deserialize: jest.fn() } as unknown as jest.Mocked<EventRegistry>;
    mockEnvelopes = { build: jest.fn() } as unknown as jest.Mocked<EnvelopeFactory>;

    repo = new TestRepository(mockStore, mockRegistry, mockEnvelopes);
  });

  describe('save', () => {
    it('returns early without calling append when aggregate has no uncommitted changes (AC-11)', async () => {
      const aggregate = new TestAggregate('agg-1');
      const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: null };

      const result = await repo.save(aggregate, ctx);

      expect(mockStore.append).not.toHaveBeenCalled();
      expect(mockEnvelopes.build).not.toHaveBeenCalled();
      expect(result).toEqual({ events: [], version: 0, lastPosition: 0n });
    });

    it('calls append when aggregate has uncommitted changes', async () => {
      const aggregate = new TestAggregate('agg-1');
      const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: null };
      const mockEvent = { eventType: 'X', schemaVersion: 1, toPayload: () => ({}) } as DomainEvent;
      aggregate.raise(mockEvent);

      const envelopes = [{ eventId: 'a', userId: 'u', aggregateType: 'Test', aggregateId: 'agg-1', sequence: 1, eventType: 'X', schemaVersion: 1, clientId: 'c', externalRef: null, payload: {}, occurredAt: new Date(), recordedAt: new Date() }];
      mockEnvelopes.build.mockReturnValue(envelopes);
      mockStore.append.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

      await repo.save(aggregate, ctx);

      expect(mockEnvelopes.build).toHaveBeenCalled();
      expect(mockStore.append).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest --testPathPattern="event-sourced.repository.spec.ts" --no-coverage 2>&1 | Select-String -Pattern "PASS|FAIL|Tests:"
```

Esperado: FAIL — el test `returns early without calling append` falla porque `save()` delega en `append()` con array vacío.

**Step 3: Agregar guard en EventSourcedRepository.save()**

En `apps/ledger/src/shared-kernel/application/event-sourced.repository.ts`, al inicio del método `save()`:

```typescript
  async save(aggregate: TAggregate, ctx: AuthContext): Promise<AppendResult> {
    const changes = aggregate.pullChanges();

    if (changes.length === 0) {
      return { events: [], version: aggregate.version, lastPosition: 0n };
    }

    const stream = this.streamId(ctx.userId, aggregate.id);
    const envelopes = this.envelopes.build(stream, aggregate.version, changes, ctx);

    return this.eventStore.append(stream, aggregate.version, envelopes);
  }
```

La diferencia con el código actual: se agrega `if (changes.length === 0) { return {...}; }` entre `pullChanges()` y `const stream = ...`.

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest --testPathPattern="event-sourced.repository.spec.ts" --no-coverage 2>&1 | Select-String -Pattern "PASS|FAIL|Tests:"
```

Esperado: PASS — ambos tests pasan.

---

### Tarea 4: Ejecutar suite completa del ledger y verificar no regresión [X]

**Step 1: Ejecutar todos los tests del ledger**

```bash
npx jest --no-coverage 2>&1 | Select-String -Pattern "PASS|FAIL|Tests:|Suites:"
```

Esperado: PASS — todos los tests existentes siguen pasando. Los cambios son puramente aditivos (guards que no alteran el comportamiento de los paths ya cubiertos).

---

### Resumen del plan

| Tarea | Archivos | Tipo |
|-------|----------|------|
| Tarea 0 | — | Branch |
| Tarea 1 | `event-store.contract.ts`, `in-memory-event-store.ts`, `postgres-event-store.ts` | Modificar |
| Tarea 2 | — | Verificación |
| Tarea 3 | `event-sourced.repository.spec.ts` (nuevo), `event-sourced.repository.ts` | Crear + Modificar |
| Tarea 4 | — | Suite completa |

**Archivos nuevos:** 1 (`event-sourced.repository.spec.ts`)
**Archivos modificados:** 3 (`event-store.contract.ts`, `in-memory-event-store.ts`, `event-sourced.repository.ts` + `postgres-event-store.ts`)
**Líneas de código:** ~30 líneas nuevas en total (guards de 3 líneas cada uno + test cases)
