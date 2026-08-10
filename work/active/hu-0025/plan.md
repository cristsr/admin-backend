# hu-0025: Políticas transversales del command bus — Plan de Implementación

**Historia:** `work/active/hu-0025/`
**Microservicio(s):** `libs/cqrs` (core: policies, puerto, adaptadores) → `apps/ledger` (wiring Nest, controllers, DTOs)
**Objetivo:** Agregar `DryRunPolicy` (preview con rollback) y `RetryPolicy` (reintento ante deadlocks `40P01`/`40001`) al chain del command bus, exponiendo `dryRun` en el body de todas las escrituras y `PERSISTENCE_CONFLICT` (409) al agotar los intentos.
**Arquitectura:** Policies sobre el mecanismo `CommandPolicy` existente (F-22 ya resuelto). La cadena pasa de 3 a 5 políticas: `[Authenticated, Retry, Idempotency, OptimisticConcurrency, DryRun]`. Dry-run ejecuta el handler dentro de `EventStore.withTransaction(work, { rollback: true })`; los read models se unen al scope transaccional (Postgres: `AsyncLocalStorage<EntityManager>` compartido; in-memory: snapshot/restore coordinado). `dryRun` viaja en el `AuthContext` (fuera del hash de idempotencia — decisión de diseño documentada en `docs/research.md`). Retry solo captura `TransientPersistenceException` (traducida en `PostgresEventStore.translate()`); `CONCURRENCY_CONFLICT` (AC-6) y `DUPLICATE_EXTERNAL_REF` (AC-7) no se capturan. Métrica AC-8 vía puerto `RetryCounter` + adapter OTel.
**Stack:** TypeScript · NestJS · TypeORM (adaptadores Postgres) · PostgreSQL · Jest (`*.spec.ts`)

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 12 (chain de 5 políticas en el wiring; ningún handler cambia) |
| AC-2 | Tarea 4, Tarea 6, Tarea 12 |
| AC-3 | Tarea 5, Tarea 6, Tarea 12 |
| AC-4 | Tarea 9, Tarea 10, Tarea 12 |
| AC-5 | Tarea 7, Tarea 11 |
| AC-6 | Tarea 7 |
| AC-7 | Tarea 7 |
| AC-8 | Tarea 7, Tarea 8 |

---

### Tarea 0: Preparar rama de trabajo [X]

> Forge ejecuta el plan en modo autónomo: la rama de trabajo ya está decidida.
> Rama: `feat/hu-0025-command-bus-policies`.

**Step 1: Verificar rama actual**

```bash
git branch --show-current
```
Esperado: `feat/core` (no es la base `develop`/`master` — forge lo validó en preflight).
Nota: el working tree tiene cambios sin commitear preexistentes (WIP de otras historias);
`git checkout -b` los conserva — no se descarta nada.

**Step 2: Crear rama de trabajo**

```bash
git checkout -b feat/hu-0025-command-bus-policies
```
Esperado: rama creada y activa. No se pushea.

---

### Tarea 1: Excepciones de dominio nuevas [X]

**Archivos:**
- Crear: `libs/cqrs/src/domain/exceptions/transient-persistence.exception.ts`
- Crear: `libs/cqrs/src/domain/exceptions/persistence-conflict.exception.ts`
- Test: `libs/cqrs/src/domain/exceptions/transient-persistence.exception.spec.ts`
- Test: `libs/cqrs/src/domain/exceptions/persistence-conflict.exception.spec.ts`

**Step 1: Escribir los tests que fallan**

En `transient-persistence.exception.spec.ts`:

```typescript
import { TransientPersistenceException } from './transient-persistence.exception';

describe('TransientPersistenceException', () => {
  it('carries a stable TRANSIENT_PERSISTENCE code', () => {
    const error = new TransientPersistenceException('boom');

    expect(error.code).toBe('TRANSIENT_PERSISTENCE');
    expect(error).toBeInstanceOf(Error);
  });
});
```

En `persistence-conflict.exception.spec.ts`:

```typescript
import { PersistenceConflictException } from './persistence-conflict.exception';

describe('PersistenceConflictException', () => {
  it('carries the stable PERSISTENCE_CONFLICT code', () => {
    const error = new PersistenceConflictException('exhausted');

    expect(error.code).toBe('PERSISTENCE_CONFLICT');
  });
});
```

**Step 2: Ejecutar y confirmar que fallan**

```bash
npx jest libs/cqrs/src/domain/exceptions --no-coverage
```
Esperado: FAIL — "Cannot find module".

**Step 3: Implementar**

En `transient-persistence.exception.ts`:

```typescript
import { DomainException } from '@shared';

/**
 * A transient PostgreSQL persistence failure (deadlock `40P01` or serialization
 * `40001`). Raised by the Postgres adapter so the retry policy can act on a
 * typed domain exception (Artículo 1). Never surfaces through the API: it is
 * either retried or converted into {@link PersistenceConflictException}.
 */
export class TransientPersistenceException extends DomainException {
  readonly code: string = 'TRANSIENT_PERSISTENCE';
  readonly status: number = 503;

  constructor(message: string) {
    super(message);
  }
}
```

En `persistence-conflict.exception.ts`:

```typescript
import { DomainConflictException } from '@shared';

/**
 * The stable 409 contract of the retry policy (AC-5): the transient-persistence
 * retry budget was exhausted. Replaces the raw QueryFailedError that would
 * otherwise surface as a 500 without a code.
 */
export class PersistenceConflictException extends DomainConflictException {
  readonly code: string = 'PERSISTENCE_CONFLICT';
}
```

**Step 4: Ejecutar y confirmar que pasan**

```bash
npx jest libs/cqrs/src/domain/exceptions --no-coverage
```
Esperado: PASS.

---

### Tarea 2: Puerto `RetryCounter` + `NoopRetryCounter` [X]

**Archivos:**
- Crear: `libs/cqrs/src/application/command-bus/policies/retry-counter.ts`
- Test: `libs/cqrs/src/application/command-bus/policies/retry-counter.spec.ts`

**Step 1: Test que falla**

```typescript
import { NoopRetryCounter } from './retry-counter';

describe('NoopRetryCounter', () => {
  it('accepts increments without throwing', () => {
    expect(() => new NoopRetryCounter().increment('RecordTransactionCommand')).not.toThrow();
  });
});
```

**Step 2: Ejecutar** → FAIL (module missing).

**Step 3: Implementar**

```typescript
/**
 * Minimum metric sink for the retry policy (AC-8): a counter keyed by command
 * type. Lives in the application layer as a port so the core never knows
 * OpenTelemetry (Artículo 1, RNF-12). The real adapter is the OTel counter;
 * tests and compositions that do not observe use the no-op.
 */
export abstract class RetryCounter {
  abstract increment(commandType: string): void;
}

/** Discards increments; used by compositions that do not observe (tests). */
export class NoopRetryCounter extends RetryCounter {
  increment(): void {}
}
```

**Step 4: Ejecutar** → PASS.

---

### Tarea 3: Scopes transaccionales compartidos [X]

**Archivos:**
- Crear: `libs/cqrs/src/infrastructure/adapters/transaction/postgres-transaction.scope.ts`
- Crear: `libs/cqrs/src/infrastructure/adapters/transaction/in-memory-transaction.scope.ts`
- Test: `libs/cqrs/src/infrastructure/adapters/transaction/postgres-transaction.scope.spec.ts`
- Test: `libs/cqrs/src/infrastructure/adapters/transaction/in-memory-transaction.scope.spec.ts`

**Step 1: Tests que fallan**

`postgres-transaction.scope.spec.ts`:

```typescript
import { PostgresTransactionScope } from './postgres-transaction.scope';

describe('PostgresTransactionScope', () => {
  it('exposes the manager set by run() only inside the scope', async () => {
    const scope = new PostgresTransactionScope();
    const manager = { query: jest.fn() } as never;

    expect(scope.current()).toBeUndefined();

    await scope.run(manager, async () => {
      expect(scope.current()).toBe(manager);
    });

    expect(scope.current()).toBeUndefined();
  });

  it('keeps the outer manager when scopes nest', async () => {
    const scope = new PostgresTransactionScope();
    const outer = { query: jest.fn() } as never;
    const inner = { query: jest.fn() } as never;

    await scope.run(outer, async () => {
      await scope.run(inner, async () => {
        expect(scope.current()).toBe(outer);
      });
    });
  });
});
```

`in-memory-transaction.scope.spec.ts`:

```typescript
import { InMemoryTransactionScope } from './in-memory-transaction.scope';

describe('InMemoryTransactionScope', () => {
  it('restores attached stores when the scope resolves with rollback', async () => {
    const scope = new InMemoryTransactionScope();
    const store = {
      snapshot: jest.fn(() => 'snap'),
      restore: jest.fn(),
    };

    scope.attach(store);

    await scope.run(async () => undefined, { rollback: true });

    expect(store.snapshot).toHaveBeenCalledTimes(1);
    expect(store.restore).toHaveBeenCalledWith('snap');
  });

  it('does not restore on a committed (non-rollback) run', async () => {
    const scope = new InMemoryTransactionScope();
    const store = { snapshot: jest.fn(() => 'snap'), restore: jest.fn() };

    scope.attach(store);
    await scope.run(async () => undefined);

    expect(store.restore).not.toHaveBeenCalled();
  });

  it('restores on failure even without the rollback flag', async () => {
    const scope = new InMemoryTransactionScope();
    const store = { snapshot: jest.fn(() => 'snap'), restore: jest.fn() };

    scope.attach(store);

    await expect(scope.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(store.restore).toHaveBeenCalledWith('snap');
  });

  it('joins an outer scope instead of nesting', async () => {
    const scope = new InMemoryTransactionScope();
    const store = { snapshot: jest.fn(() => 'snap'), restore: jest.fn() };

    scope.attach(store);

    await scope.run(async () => {
      await scope.run(async () => undefined, { rollback: true });
    });

    expect(store.snapshot).toHaveBeenCalledTimes(1);
    expect(store.restore).not.toHaveBeenCalled();
  });
});
```

**Step 2: Ejecutar** → FAIL (module missing).

**Step 3: Implementar**

`postgres-transaction.scope.ts`:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager } from 'typeorm';

/**
 * Shared transaction carrier for the PostgreSQL adapters. The event store opens
 * the scope around a command's unit of work; the read model store routes its
 * writes through the same scoped manager, so synchronous projections join the
 * command transaction (AC-2: a dry-run rollback reverts them too).
 */
export class PostgresTransactionScope {
  private readonly als = new AsyncLocalStorage<EntityManager>();

  run<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return this.als.run(manager, work);
  }

  current(): EntityManager | undefined {
    return this.als.getStore();
  }
}
```

`in-memory-transaction.scope.ts`:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

/** A store whose in-memory state can be snapshotted and restored atomically. */
export interface SnapshotableStore {
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

type ScopeState = {
  readonly snapshots: Map<SnapshotableStore, unknown>;
};

/**
 * Coordinates cross-store rollback for the in-memory adapters: a scope opened
 * with `rollback` snapshots every attached store (event store + read model)
 * and restores them when it resolves — a dry-run preview leaves no observable
 * effect (AC-3). A failed run always restores; a successful non-rollback run
 * commits. Nested runs join the outer scope.
 */
export class InMemoryTransactionScope {
  private readonly als = new AsyncLocalStorage<ScopeState>();
  private readonly stores = new Set<SnapshotableStore>();

  attach(store: SnapshotableStore): void {
    this.stores.add(store);
  }

  current(): ScopeState | undefined {
    return this.als.getStore();
  }

  async run<T>(work: () => Promise<T>, options?: { rollback?: boolean }): Promise<T> {
    const outer = this.als.getStore();

    if (outer) return work();

    const snapshots = new Map<SnapshotableStore, unknown>();
    for (const store of this.stores) snapshots.set(store, store.snapshot());

    return this.als.run({ snapshots }, async () => {
      try {
        const result = await work();
        if (options?.rollback) this.restore(snapshots);
        return result;
      } catch (error) {
        this.restore(snapshots);
        throw error;
      }
    });
  }

  private restore(snapshots: Map<SnapshotableStore, unknown>): void {
    for (const [store, snapshot] of snapshots) store.restore(snapshot);
  }
}
```

**Step 4: Ejecutar** → PASS.

---

### Tarea 4: `EventStore.withTransaction` con modo rollback (puerto + 2 adaptadores + contract test) [X]

**Archivos:**
- Modificar: `libs/cqrs/src/domain/ports/event-store.ts` (firma de `withTransaction`)
- Modificar: `libs/cqrs/src/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`
- Modificar: `libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts`
- Modificar: `libs/cqrs/src/infrastructure/testing/event-store.contract.ts` (casos nuevos de rollback)
- Modificar: `libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-store.spec.ts` (si es necesario, el store se construye sin cambios — el contrato lo corre)
- Modificar: `apps/ledger/src/shared/infrastructure/adapters/event-store/postgres-event-store.integration.spec.ts` (construcción con scope compartido)

**Step 1: Agregar casos al contract test**

En `event-store.contract.ts`, dentro de `describeEventStoreContract` (junto al bloque
`withTransaction — cross-stream atomicity`, ~línea 246):

```typescript
describe('withTransaction — rollback mode (hu-0025)', () => {
  it('returns the work result and persists nothing when rollback: true', async () => {
    const store = makeStore();
    const stream = streamFor('u', 'agg');

    const result = await store.withTransaction(
      async () => {
        await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);
        return 'done';
      },
      { rollback: true },
    );

    expect(result).toBe('done');
    expect(await store.load(stream)).toEqual([]);
    expect(await store.readAll(0n, 10)).toEqual([]);
  });

  it('commits normally when the rollback option is absent (unchanged contract)', async () => {
    const store = makeStore();
    const stream = streamFor('u', 'agg');

    await store.withTransaction(async () => {
      await store.append(stream, 0, [anEnvelope(stream, { sequence: 1 })]);
    });

    expect(await store.load(stream)).toHaveLength(1);
  });
});
```

> El helper `makeStore` es el parámetro del contract; `streamFor`/`anEnvelope` son los
> helpers existentes del archivo. Verificar nombres exactos al editar.

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest libs/cqrs/src/infrastructure/adapters/event-store --no-coverage
```
Esperado: FAIL — la firma actual no acepta el segundo argumento (TypeScript) o el caso de rollback persiste eventos.

**Step 3: Implementar**

En `libs/cqrs/src/domain/ports/event-store.ts` (agregar tipo y cambiar firma):

```typescript
/** Options for {@link EventStore.withTransaction}. */
export type TransactionOptions = {
  /**
   * When true, the scope executes `work` and always rolls back, returning
   * `work`'s result. Backs the dry-run preview (AC-2): the command runs fully
   * inside the transaction — validations, aggregate invariants, event
   * generation and synchronous projections — and only the commit is skipped.
   */
  readonly rollback?: boolean;
};
```

```typescript
  abstract withTransaction<T>(
    work: () => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;
```

En `postgres-event-store.ts`:

```typescript
  async withTransaction<T>(
    work: () => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const running = this.scope.current();

    if (running) return work(); // guard: an inner call joins the outer scope

    if (!options?.rollback) {
      return this.dataSource.transaction((manager) => this.scope.run(manager, work));
    }

    // Rollback mode: a manual query runner lets us execute the work and then
    // roll back instead of committing. The advisory xact lock is released by
    // the rollback; positions are burned (identity), which is harmless for
    // projection catch-up (`global_position > from`).
    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      const result = await this.scope.run(runner.manager, work);
      await runner.rollbackTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
```

> El `this.scope` privado (`AsyncLocalStorage<EntityManager>`) se reemplaza por el
> `PostgresTransactionScope` de la Tarea 3: constructor pasa a
> `constructor(private readonly dataSource: DataSource, private readonly scope: PostgresTransactionScope)`.
> Actualizar los `this.scope.getStore()` → `this.scope.current()` y el `this.scope.run(...)`
> en los otros usos del adaptador.

En `in-memory-event-store.ts`:

```typescript
  async withTransaction<T>(
    work: () => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    if (this.depth > 0) return work(); // guard: an inner call joins the outer scope

    if (this.scope) {
      // Shared-scope path: the scope snapshots every attached store (event
      // store + read model) so a rollback reverts projections too (AC-3).
      return this.scope.run(work, options);
    }

    const snapshot = [...this.events];
    const chainsSnapshot = new Map(this.chains);
    const positionBefore = this.nextPosition;
    this.depth += 1;

    try {
      const result = await work();
      if (options?.rollback) {
        this.restoreTo(snapshot, chainsSnapshot, positionBefore);
      }
      return result;
    } catch (error) {
      this.restoreTo(snapshot, chainsSnapshot, positionBefore);
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  private restoreTo(
    events: readonly StoredEvent[],
    chains: ReadonlyMap<string, Chained>,
    nextPosition: bigint,
  ): void {
    this.events.length = 0;
    this.events.push(...events);
    this.chains.clear();
    for (const [id, chained] of chains) this.chains.set(id, chained);
    this.nextPosition = nextPosition;
  }
```

> Constructor: `constructor(private readonly scope?: InMemoryTransactionScope)` +
> `this.scope?.attach(this)` en el cuerpo. Import de `TransactionOptions` desde el puerto.

**Step 4: Ejecutar y confirmar que pasan**

```bash
npx jest libs/cqrs/src/infrastructure/adapters/event-store --no-coverage
```
Esperado: PASS (contract in-memory completo + casos nuevos de rollback).

> Sitios de construcción de `PostgresEventStore` a actualizar (buscar `new PostgresEventStore`):
> `apps/ledger/src/shared/infrastructure/adapters/event-store/postgres-event-store.integration.spec.ts`
> y cualquier tooling que lo instancie (`apps/ledger/src/tooling/rebuild.command.ts` si aplica).
> Todos pasan una instancia compartida de `PostgresTransactionScope` (que también recibe el
> `PostgresReadModelStore` cuando se construya en el mismo test).

---

### Tarea 5: Read models al scope transaccional [X]

**Archivos:**
- Modificar: `libs/cqrs/src/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.ts`
- Modificar: `libs/cqrs/src/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store.ts`
- Crear: `libs/cqrs/src/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.spec.ts`
- Crear: `libs/cqrs/src/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store.spec.ts`

**Step 1: Tests que fallan**

`postgres-read-model-store.spec.ts`:

```typescript
import { PostgresReadModelStore } from './postgres-read-model-store';
import { PostgresTransactionScope } from '../../transaction/postgres-transaction.scope';

describe('PostgresReadModelStore (transaction scope)', () => {
  const dataSource = {
    query: jest.fn().mockResolvedValue([]),
  } as never;

  it('routes writes through the scoped manager when a transaction is open', async () => {
    const scope = new PostgresTransactionScope();
    const store = new PostgresReadModelStore(dataSource, scope);
    const manager = { query: jest.fn().mockResolvedValue([]) } as never;

    await scope.run(manager, async () => {
      await store.upsert('proj_t', { id: '1' }, { name: 'x' });
    });

    expect(manager.query).toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('uses the data source directly when no transaction is open', async () => {
    const scope = new PostgresTransactionScope();
    const store = new PostgresReadModelStore(dataSource, scope);

    await store.upsert('proj_t', { id: '1' }, { name: 'x' });

    expect(dataSource.query).toHaveBeenCalled();
  });
});
```

`in-memory-read-model-store.spec.ts`:

```typescript
import { InMemoryEventStore } from '../../event-store/in-memory/in-memory-event-store';
import { InMemoryTransactionScope } from '../../transaction/in-memory-transaction.scope';
import { InMemoryReadModelStore } from './in-memory-read-model-store';

describe('InMemoryReadModelStore (transaction scope)', () => {
  it('reverts upserts when the shared scope rolls back (AC-3)', async () => {
    const scope = new InMemoryTransactionScope();
    const eventStore = new InMemoryEventStore(scope);
    const readModel = new InMemoryReadModelStore(scope);

    await eventStore.withTransaction(
      async () => {
        await readModel.upsert('proj_t', { id: '1' }, { name: 'x' });
      },
      { rollback: true },
    );

    expect(await readModel.query('proj_t', Criteria.none())).toEqual([]);
  });

  it('keeps upserts when the scope commits', async () => {
    const scope = new InMemoryTransactionScope();
    const eventStore = new InMemoryEventStore(scope);
    const readModel = new InMemoryReadModelStore(scope);

    await eventStore.withTransaction(async () => {
      await readModel.upsert('proj_t', { id: '1' }, { name: 'x' });
    });

    expect(await readModel.query('proj_t', Criteria.none())).toHaveLength(1);
  });
});
```

(importar `Criteria` de `@shared`.)

**Step 2: Ejecutar** → FAIL.

**Step 3: Implementar**

`postgres-read-model-store.ts` — constructor y executor:

```typescript
import { PostgresTransactionScope } from '../../transaction/postgres-transaction.scope';

  constructor(
    private readonly dataSource: DataSource,
    private readonly scope: PostgresTransactionScope,
  ) {
    super();
  }

  /** Writes join the command's transaction when one is open (AC-2). */
  private executor(): DataSource | EntityManager {
    return this.scope.current() ?? this.dataSource;
  }
```

Reemplazar **todos** los `this.dataSource.query(...)` de `upsert`, `delete`, `query`,
`count`, `truncate`, `queryRaw` y `queryOneRaw` por `this.executor().query(...)`.
(import de `EntityManager` de `typeorm` si el tipo no está ya importado).

`in-memory-read-model-store.ts` — constructor + snapshot/restore:

```typescript
import { InMemoryTransactionScope, SnapshotableStore } from '../../transaction/in-memory-transaction.scope';

export class InMemoryReadModelStore extends ReadModelStore implements SnapshotableStore {
  private readonly tables = new Map<string, Map<string, ReadModelRow>>();

  constructor(private readonly scope?: InMemoryTransactionScope) {
    super();
    this.scope?.attach(this);
  }

  snapshot(): unknown {
    const tables = new Map<string, Map<string, ReadModelRow>>();
    for (const [name, rows] of this.tables) tables.set(name, new Map(rows));
    return tables;
  }

  restore(snapshot: unknown): void {
    const tables = snapshot as Map<string, Map<string, ReadModelRow>>;
    this.tables.clear();
    for (const [name, rows] of tables) this.tables.set(name, new Map(rows));
  }
```

> Los rows se reemplazan por completo en `upsert` (nunca se mutan in-place), así que el
> copy de los maps es suficiente — misma lógica que el snapshot del event store.

**Step 4: Ejecutar** → PASS.

---

### Tarea 6: `DryRunPolicy` [X]

**Archivos:**
- Crear: `libs/cqrs/src/application/command-bus/policies/dry-run.policy.ts`
- Test: `libs/cqrs/src/application/command-bus/policies/dry-run.policy.spec.ts`

**Step 1: Test que falla**

```typescript
import { EventStore } from '@cqrs/domain/ports/event-store';
import { CommandResult } from '../command-result.type';
import { DryRunPolicy } from './dry-run.policy';

const RESULT: CommandResult = {
  aggregateId: 'agg-1',
  streamPosition: 7n,
  idempotentReplay: false,
};

describe('DryRunPolicy', () => {
  const command = { commandType: 'RecordTransactionCommand' } as never;
  const ctx = { userId: 'u', clientId: 'c', externalRef: null };

  function policyWith(store: EventStore) {
    return new DryRunPolicy(store);
  }

  it('passes through without opening a transaction when dryRun is not set', async () => {
    const withTransaction = jest.fn(async (work: () => Promise<CommandResult>) => work());
    const store = { withTransaction } as unknown as EventStore;
    const next = jest.fn(async () => RESULT);

    await expect(policyWith(store).handle(command, ctx, next)).resolves.toBe(RESULT);

    expect(next).toHaveBeenCalledTimes(1);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('runs the handler inside withTransaction({ rollback: true }) and returns its result', async () => {
    const withTransaction = jest.fn(async (work: () => Promise<CommandResult>) => work());
    const store = { withTransaction } as unknown as EventStore;
    const next = jest.fn(async () => RESULT);

    const result = await policyWith(store).handle(command, { ...ctx, dryRun: true }, next);

    expect(result).toBe(RESULT);
    expect(next).toHaveBeenCalledTimes(1);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(withTransaction.mock.calls[0][1]).toEqual({ rollback: true });
  });

  it('propagates a failing handler', async () => {
    const withTransaction = jest.fn(async (work: () => Promise<CommandResult>) => work());
    const store = { withTransaction } as unknown as EventStore;
    const next = jest.fn(async () => { throw new Error('domain failure'); });

    await expect(
      policyWith(store).handle(command, { ...ctx, dryRun: true }, next),
    ).rejects.toThrow('domain failure');
  });
});
```

**Step 2: Ejecutar** → FAIL (module missing).

**Step 3: Implementar**

```typescript
import { EventStore } from '@cqrs/domain/ports/event-store';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';

/**
 * Executes a command inside a transaction and always rolls it back (F-12,
 * AC-2). The preview cannot diverge from a real run because it is the real
 * run: validations, aggregate invariants, event generation and the synchronous
 * projections all happen inside the transaction, then only the commit is
 * skipped. The produced {@link CommandResult} is returned unchanged (AC-4).
 *
 * No reactor (§3.2) ever fires for a preview: reactors consume the persisted
 * stream, and a rollback persists nothing (AC-3). Event ids are UUIDs — there
 * is no sequence to burn; `global_position` gaps are harmless for catch-up.
 */
export class DryRunPolicy extends CommandPolicy {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    if (!ctx.dryRun) return next(ctx);

    return this.eventStore.withTransaction(() => next(ctx), { rollback: true });
  }
}
```

**Step 4: Ejecutar** → PASS.

---

### Tarea 7: `RetryPolicy` [X]

**Archivos:**
- Crear: `libs/cqrs/src/application/command-bus/policies/retry.policy.ts`
- Test: `libs/cqrs/src/application/command-bus/policies/retry.policy.spec.ts`

**Step 1: Test que falla**

```typescript
import { ConcurrencyConflictException, DuplicateExternalRefException } from '@cqrs/domain/exceptions/event-store.exception';
import { PersistenceConflictException } from '@cqrs/domain/exceptions/persistence-conflict.exception';
import { TransientPersistenceException } from '@cqrs/domain/exceptions/transient-persistence.exception';
import { CommandResult } from '../command-result.type';
import { NoopRetryCounter, RetryCounter } from './retry-counter';
import { RetryPolicy } from './retry.policy';

const RESULT: CommandResult = {
  aggregateId: 'agg-1',
  streamPosition: 7n,
  idempotentReplay: false,
};

describe('RetryPolicy', () => {
  const command = { commandType: 'RecordTransactionCommand' } as never;
  const ctx = { userId: 'u', clientId: 'c', externalRef: null };
  const transient = (): never => { throw new TransientPersistenceException('deadlock'); };

  function setup(waits: number[] = []) {
    const counter = { increments: [] as string[] } as RetryCounter & { increments: string[] };
    counter.increment = (type: string) => counter.increments.push(type);
    const sleeps: number[] = [];
    const policy = new RetryPolicy(counter, async (ms) => { sleeps.push(ms); });

    return { policy, counter, sleeps };
  }

  it('succeeds on the first attempt without sleeping or counting', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest.fn(async () => RESULT);

    await expect(policy.handle(command, ctx, next)).resolves.toBe(RESULT);

    expect(next).toHaveBeenCalledTimes(1);
    expect(counter.increments).toEqual([]);
    expect(sleeps).toEqual([]);
  });

  it('retries a transient failure until success, counting each retry (AC-5, AC-8)', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest
      .fn()
      .mockImplementationOnce(transient)
      .mockImplementationOnce(transient)
      .mockResolvedValueOnce(RESULT);

    await expect(policy.handle(command, ctx, next)).resolves.toBe(RESULT);

    expect(next).toHaveBeenCalledTimes(3);
    expect(counter.increments).toEqual(['RecordTransactionCommand', 'RecordTransactionCommand']);
    expect(sleeps).toHaveLength(2);
  });

  it('applies exponential backoff with jitter between attempts', async () => {
    const { policy, sleeps } = setup();
    const next = jest
      .fn()
      .mockImplementationOnce(transient)
      .mockImplementationOnce(transient)
      .mockResolvedValueOnce(RESULT);

    await policy.handle(command, ctx, next);

    expect(sleeps[0]).toBeGreaterThanOrEqual(10);
    expect(sleeps[0]).toBeLessThanOrEqual(40);
    expect(sleeps[1]).toBeGreaterThanOrEqual(20);
    expect(sleeps[1]).toBeLessThanOrEqual(50);
  });

  it('throws PERSISTENCE_CONFLICT once the 3-attempt budget is exhausted (AC-5)', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest.fn(transient);

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      PersistenceConflictException,
    );

    expect(next).toHaveBeenCalledTimes(3);
    expect(counter.increments).toHaveLength(2);
    expect(sleeps).toHaveLength(2);
  });

  it('never retries a concurrency conflict (AC-6)', async () => {
    const { policy, counter, sleeps } = setup();
    const next = jest.fn(async () => { throw new ConcurrencyConflictException('conflict'); });

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      ConcurrencyConflictException,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(counter.increments).toEqual([]);
    expect(sleeps).toEqual([]);
  });

  it('never retries a duplicate external ref — the idempotency policy owns it (AC-7)', async () => {
    const { policy, counter } = setup();
    const next = jest.fn(async () => { throw new DuplicateExternalRefException('dup'); });

    await expect(policy.handle(command, ctx, next)).rejects.toBeInstanceOf(
      DuplicateExternalRefException,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(counter.increments).toEqual([]);
  });

  it('accepts a no-op counter for compositions that do not observe', async () => {
    const policy = new RetryPolicy(new NoopRetryCounter(), async () => undefined);
    const next = jest.fn(transient).mockResolvedValueOnce(RESULT).mockImplementationOnce(transient).mockResolvedValueOnce(RESULT);

    await expect(policy.handle(command, ctx, next)).resolves.toBe(RESULT);
  });
});
```

**Step 2: Ejecutar** → FAIL (module missing).

**Step 3: Implementar**

```typescript
import { PersistenceConflictException } from '@cqrs/domain/exceptions/persistence-conflict.exception';
import { TransientPersistenceException } from '@cqrs/domain/exceptions/transient-persistence.exception';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';
import { RetryCounter } from './retry-counter';

/** Total attempts including the original execution (AC-5). */
const TOTAL_ATTEMPTS = 3;
/** Exponential base delay; jitter keeps concurrent retries from re-colliding. */
const BASE_DELAY_MS = 10;
const JITTER_MAX_MS = 30;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries a command whose persistence failed transiently — deadlock (`40P01`)
 * or serialization (`40001`), surfaced by the Postgres adapter as
 * {@link TransientPersistenceException} (F-14, AC-5). The command was valid; it
 * only lost a lock race, so the whole chain is re-run (handlers are
 * deterministic given the same starting state).
 *
 * Bounded: 3 attempts total with exponential backoff + jitter. On exhaustion it
 * raises the stable {@link PersistenceConflictException} (409) instead of the
 * raw driver error. It never catches {@link ConcurrencyConflictException}
 * (AC-6: the aggregate moved; the concurrency policy's own retry-once with
 * reload owns that) nor {@link DuplicateExternalRefException} (AC-7: the
 * idempotency policy re-reads the anchor).
 *
 * Each retry increments {@link RetryCounter} keyed by command type (AC-8).
 */
export class RetryPolicy extends CommandPolicy {
  constructor(
    private readonly counter: RetryCounter,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {
    super();
  }

  async handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    for (let attempt = 0; attempt < TOTAL_ATTEMPTS; attempt += 1) {
      try {
        return await next(ctx);
      } catch (error) {
        if (!(error instanceof TransientPersistenceException)) throw error;

        if (attempt === TOTAL_ATTEMPTS - 1) {
          throw new PersistenceConflictException(
            `Transient persistence failure exhausted after ${TOTAL_ATTEMPTS} attempts`,
          );
        }

        this.counter.increment(command.commandType);
        await this.wait(BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * JITTER_MAX_MS));
      }
    }

    throw new PersistenceConflictException(
      `Transient persistence failure exhausted after ${TOTAL_ATTEMPTS} attempts`,
    );
  }
}
```

**Step 4: Ejecutar** → PASS.

---

### Tarea 8: `OtelRetryCounter` [X]

**Archivos:**
- Crear: `libs/cqrs/src/infrastructure/adapters/telemetry/otel-retry-counter.ts`
- Test: `libs/cqrs/src/infrastructure/adapters/telemetry/otel-retry-counter.spec.ts`
- Modificar: `libs/cqrs/package.json` (declarar `@opentelemetry/api` si no está)

**Step 0: Verificar dependencia**

```bash
rg -n "opentelemetry" libs/cqrs/package.json || echo "MISSING"
```
Si falta, agregar `"@opentelemetry/api": "^1.9.1"` a `dependencies` de `libs/cqrs/package.json`
(está en el `package.json` raíz; el lint de module boundaries exige la declaración).

**Step 1: Test que falla**

```typescript
import { metrics } from '@opentelemetry/api';
import { InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OtelRetryCounter } from './otel-retry-counter';

describe('OtelRetryCounter', () => {
  let exporter: InMemoryMetricExporter;
  let reader: PeriodicExportingMetricReader;

  beforeEach(() => {
    exporter = new InMemoryMetricExporter();
    reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
  });

  afterEach(async () => {
    await reader.shutdown();
    metrics.disable();
  });

  it('records one count per command type with the command as attribute (AC-8)', async () => {
    const counter = new OtelRetryCounter();

    counter.increment('RecordTransactionCommand');
    counter.increment('RecordTransactionCommand');
    counter.increment('ConfirmTransactionCommand');

    await reader.forceFlush();

    const points = exporter
      .getMetrics()
      .flatMap((resource) => resource.scopeMetrics.flatMap((sm) => sm.metrics))
      .filter((metric) => metric.descriptor.name === 'ledger.command.retries')
      .flatMap((metric) =>
        metric.dataPoints.map((point) => ({
          commandType: point.attributes['ledger.command.type'] as string,
          value: typeof point.value === 'number' ? point.value : Number(point.value),
        })),
      );

    expect(points).toContainEqual({ commandType: 'RecordTransactionCommand', value: 2 });
    expect(points).toContainEqual({ commandType: 'ConfirmTransactionCommand', value: 1 });
  });
});
```

**Step 2: Ejecutar** → FAIL (module missing).

**Step 3: Implementar**

```typescript
import { Counter, metrics } from '@opentelemetry/api';
import { RetryCounter } from '@cqrs/application/command-bus/policies/retry-counter';

const METER_NAME = 'ledger.command-bus';
const METRIC_NAME = 'ledger.command.retries';
const COMMAND_TYPE_ATTRIBUTE = 'ledger.command.type';

/**
 * {@link RetryCounter} backed by an OpenTelemetry Counter (AC-8, RNF-12). The
 * fourth metric of RNF-12 — transient-persistence retries per command type —
 * implemented now without pulling in the rest of hu-0022.
 */
export class OtelRetryCounter extends RetryCounter {
  private readonly counter: Counter;

  constructor() {
    super();
    this.counter = metrics.getMeter(METER_NAME).createCounter(METRIC_NAME, {
      description: 'Transient-persistence retries per command type (AC-8).',
    });
  }

  increment(commandType: string): void {
    this.counter.add(1, { [COMMAND_TYPE_ATTRIBUTE]: commandType });
  }
}
```

**Step 4: Ejecutar** → PASS.

---

### Tarea 9: `AuthContext.dryRun` + controllers [X]

**Archivos:**
- Modificar: `libs/cqrs/src/application/command-bus/auth-context.type.ts`
- Modificar: `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts`
- Modificar: `apps/ledger/src/ledger/infrastructure/adapters/http/ledger.controller.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/adapters/http/transfer.controller.ts`
- Modificar: `apps/ledger/src/reference/infrastructure/adapters/http/currencies.controller.ts`
- Modificar: `apps/ledger/src/reconciliation/infrastructure/adapters/http/balance-assertion.controller.ts`
- Crear: `apps/ledger/src/reconciliation/infrastructure/adapters/http/dto/resolve-discrepancy-request.dto.ts`
- Test: `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.spec.ts` (agregar casos)

**Step 1: Test que falla**

En `accounts.controller.spec.ts`, dentro del describe existente (crear el describe si no
existe la estructura; el spec ya mockea `CommandBus`/`QueryBus`):

```typescript
describe('dry-run preview (hu-0025, AC-4)', () => {
  it('carries body.dryRun into the AuthContext of every write', async () => {
    const dispatch = jest.fn().mockResolvedValue({
      aggregateId: 'agg-1',
      streamPosition: 1n,
      idempotentReplay: false,
    });
    const controller = new AccountsController(
      { dispatch } as unknown as CommandBus,
      { ask: jest.fn() } as unknown as QueryBus,
    );

    await controller.open(
      { userId: 'u', clientId: 'c' } as never,
      null,
      {
        type: 'ASSETS',
        name: 'Assets:Bank',
        currencies: ['COP'],
        openedOn: '2026-01-01',
        isBankMirror: false,
        dryRun: true,
      } as never,
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dryRun: true }),
    );
  });

  it('leaves dryRun undefined when the body omits it', async () => {
    const dispatch = jest.fn().mockResolvedValue({
      aggregateId: 'agg-1',
      streamPosition: 1n,
      idempotentReplay: false,
    });
    const controller = new AccountsController(
      { dispatch } as unknown as CommandBus,
      { ask: jest.fn() } as unknown as QueryBus,
    );

    await controller.rename({ userId: 'u', clientId: 'c' } as never, null, 'a-1', {
      newName: 'Assets:Other',
    } as never);

    expect(dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dryRun: undefined }),
    );
  });
});
```

(Agregar los imports de `AccountsController`, `CommandBus` y `QueryBus` que falten.)

**Step 2: Ejecutar** → FAIL (AuthContext no tiene `dryRun` / controllers no lo pasan).

**Step 3: Implementar**

`auth-context.type.ts` — agregar al tipo:

```typescript
  /**
   * Preview mode (hu-0025): the write executes fully inside a transaction and
   * rolls back, returning the result the real run would have produced.
   * Transport metadata — carried on the context (like `externalRef`), never on
   * the Command, so it stays out of the idempotency input hash by construction.
   */
  readonly dryRun?: boolean;
```

Controllers — cada escritura pasa `body.dryRun` al ctx:

`accounts.controller.ts`:
- `private authContext(context: LedgerContext, externalRef: Nullable<string>, dto: { dryRun?: boolean }): AuthContext` → `return { userId: context.userId, clientId: context.clientId, externalRef, dryRun: dto.dryRun };`
- Los 4 calls: `this.authContext(context, externalRef, dto)`.

`ledger.controller.ts` (2 ctx inline de `initialize` y `replaceSettings`):
- `dryRun: dto.dryRun` en ambos.

`transactions.controller.ts`:
- `private dispatch(command: Command, context: LedgerContext, externalRef: Nullable<string>, dto: { dryRun?: boolean })` → ctx con `dryRun: dto.dryRun`.
- Calls: `record` → `this.dispatch(command, context, externalRef, dto)`; `amend`/`annotate`/`void` → `(command, context, externalRef, dto)`; `confirm`/`reverse` → `(command, context, externalRef, _dto)`.

`transfer.controller.ts`:
- ctx inline: agregar `dryRun: body.dryRun`.

`currencies.controller.ts`:
- ctx inline de `register`: agregar `dryRun: dto.dryRun`.

`balance-assertion.controller.ts`:
- `private dispatch(command: Command, context: LedgerContext, externalRef: Nullable<string>, dto: { dryRun?: boolean })` → ctx con `dryRun: dto.dryRun`.
- Calls: `assert` → `(command, context, externalRef, body)`; `revoke` → `(command, context, externalRef, body)`; `resolve` → `(command, context, externalRef, body)` con el nuevo DTO.

`dto/resolve-discrepancy-request.dto.ts` (nuevo):

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Body of `POST /balance-assertions/{id}/resolve`, introduced by hu-0025 so
 * every write accepts the dry-run preview (AC-4). Empty bodies behave exactly
 * as before — `dryRun` is optional.
 */
export class ResolveDiscrepancyRequestDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
```

`balance-assertion.controller.ts` `resolve` pasa a recibir el body:

```typescript
  resolve(
    @Context() context: LedgerContext,
    @ExternalRef() externalRef: Nullable<string>,
    @Param('id') id: string,
    @Body() body: ResolveDiscrepancyRequestDto,
  ): Promise<CommandResult> {
    return this.dispatch(new ResolveDiscrepancyCommand(id), context, externalRef, body);
  }
```

(import del DTO; el barrel `dto/index.ts` del módulo reconciliation exporta el nuevo DTO.)

**Step 4: Ejecutar**

```bash
npx jest apps/ledger/src/accounts/infrastructure/adapters/http --no-coverage
```
Esperado: PASS. Luego correr los specs de los otros controllers:

```bash
npx jest apps/ledger/src --no-coverage
```
Esperado: PASS (los specs existentes de controllers siguen verdes; si un spec mockea
`authContext`/`dispatch` con aridad distinta, actualizar el mock).

---

### Tarea 10: `dryRun` en los 16 request DTOs [X]

**Archivos (modificar todos):**
- `apps/ledger/src/accounts/infrastructure/adapters/http/dto/open-account-request.dto.ts`
- `.../dto/rename-account-request.dto.ts`
- `.../dto/close-account-request.dto.ts`
- `.../dto/record-opening-balance-request.dto.ts`
- `apps/ledger/src/ledger/infrastructure/adapters/http/dto/initialize-ledger-request.dto.ts`
- `.../dto/replace-ledger-settings-request.dto.ts`
- `apps/ledger/src/transactions/infrastructure/adapters/http/dto/record-transaction-request.dto.ts`
- `.../dto/confirm-transaction-request.dto.ts`
- `.../dto/amend-transaction-request.dto.ts`
- `.../dto/annotate-transaction-request.dto.ts`
- `.../dto/void-transaction-request.dto.ts`
- `.../dto/reverse-transaction-request.dto.ts`
- `.../dto/merge-transfers-request.dto.ts`
- `apps/ledger/src/reconciliation/infrastructure/adapters/http/dto/assert-balance-request.dto.ts`
- `.../dto/revoke-assertion-request.dto.ts`
- `apps/ledger/src/reference/infrastructure/adapters/http/dto/register-currency-request.dto.ts`
- (nuevo en Tarea 9) `.../reconciliation/.../dto/resolve-discrepancy-request.dto.ts`

**Step 1: Implementar el snippet idéntico en cada DTO**

En cada clase, agregar la propiedad (con imports de `ApiPropertyOptional` de
`@nestjs/swagger` y `IsBoolean`/`IsOptional` de `class-validator` si no están):

```typescript
  @ApiPropertyOptional({ default: false, description: 'Preview mode (hu-0025): execute the command fully inside the transaction and roll back, returning the result the real run would have produced.' })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
```

> Sin test unitario por DTO (DTOs puros — validación cubierta por los e2e de la
> Tarea 12 y por el contrato OpenAPI de `/sync`).

**Step 2: Verificar compilación**

```bash
npx nx run ledger:build --skip-nx-cache 2>&1 | Select-Object -Last 5
```
Esperado: BUILD SUCCESS.

---

### Tarea 11: `PostgresEventStore.translate()` traduce `40P01`/`40001` [X]

**Archivos:**
- Modificar: `libs/cqrs/src/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`
- Crear: `libs/cqrs/src/infrastructure/adapters/event-store/postgres/postgres-event-store.spec.ts`

**Step 1: Test que falla**

```typescript
import { QueryFailedError } from 'typeorm';
import { DuplicateExternalRefException } from '@cqrs/domain/exceptions/event-store.exception';
import { TransientPersistenceException } from '@cqrs/domain/exceptions/transient-persistence.exception';
import { PostgresEventStore } from './postgres-event-store';
import { PostgresTransactionScope } from '../../transaction/postgres-transaction.scope';

function queryFailed(code: string, constraint?: string): QueryFailedError {
  return { driverError: { code, constraint } } as unknown as QueryFailedError;
}

describe('PostgresEventStore.translate (transient codes)', () => {
  function storeWith(driverError: unknown) {
    const dataSource = {
      transaction: jest.fn(async () => {
        throw driverError;
      }),
      query: jest.fn(),
      createQueryRunner: jest.fn(),
    } as never;
    return new PostgresEventStore(dataSource as never, new PostgresTransactionScope());
  }

  it('maps deadlock_detected (40P01) to TransientPersistenceException', async () => {
    const store = storeWith(queryFailed('40P01'));

    await expect(store.append({} as never, 0, [] as never)).rejects.toBeInstanceOf(
      TransientPersistenceException,
    );
  });

  it('maps serialization_failure (40001) to TransientPersistenceException', async () => {
    const store = storeWith(queryFailed('40001'));

    await expect(store.append({} as never, 0, [] as never)).rejects.toBeInstanceOf(
      TransientPersistenceException,
    );
  });

  it('keeps mapping the external-ref unique violation to DuplicateExternalRefException', async () => {
    const store = storeWith(queryFailed('23505', 'idx_event_external_ref'));

    await expect(store.append({} as never, 0, [] as never)).rejects.toBeInstanceOf(
      DuplicateExternalRefException,
    );
  });

  it('lets unrelated driver errors pass through unchanged', async () => {
    const error = queryFailed('22003');
    const store = storeWith(error);

    await expect(store.append({} as never, 0, [] as never)).rejects.toBe(error);
  });
});
```

> `append` con `events: []` retorna temprano — usar un batch no vacío o un stream que haga
> llegar el error antes del no-op. Si el no-op corta, mockear `transaction` igual alcanza:
> `append` con batch no vacío entra a `dataSource.transaction(...)` y el throw del mock
> llega a `translate()`.

**Step 2: Ejecutar** → FAIL (no traduce; el error crudo pasa).

**Step 3: Implementar**

En `postgres-event-store.ts`, al inicio del bloque de códigos de `translate()`:

```typescript
    const driverError = error.driverError as { code?: string; constraint?: string };

    if (driverError?.code === '40P01' || driverError?.code === '40001') {
      return new TransientPersistenceException(
        `Transient PostgreSQL failure (${driverError.code})`,
      );
    }

    if (driverError?.code !== UNIQUE_VIOLATION) return error;
```

(import de `TransientPersistenceException`.)

**Step 4: Ejecutar**

```bash
npx jest libs/cqrs/src/infrastructure/adapters/event-store/postgres --no-coverage
```
Esperado: PASS.

---

### Tarea 12: Composition root — chain de 5 políticas + wiring Nest + e2e de dry-run [X]

**Archivos:**
- Modificar: `apps/ledger/src/bootstrap/ledger-application.factory.ts`
- Modificar: `apps/ledger/src/bootstrap/ledger-core.module.ts`
- Modificar: `apps/ledger/src/bootstrap/ledger-application.spec.ts` (describe nuevo de dry-run y retry)
- Modificar: `libs/cqrs/src/application/command-bus/command-bus.spec.ts` (si hace falta ajustar el contrato del bus con las policies nuevas — solo si el spec fija el número de policies)

**Step 1: Test que falla (e2e sobre la composición in-memory)**

En `ledger-application.spec.ts`, agregar:

```typescript
import { InMemoryTransactionScope } from '@cqrs/infrastructure/adapters/transaction/in-memory-transaction.scope';
import { TransientPersistenceException } from '@cqrs/domain/exceptions/transient-persistence.exception';
import { PersistenceConflictException } from '@cqrs/domain/exceptions/persistence-conflict.exception';

describe('Dry-run preview (in-memory composition, hu-0025)', () => {
  function dryRunSetup() {
    const scope = new InMemoryTransactionScope();
    const eventStore = new InMemoryEventStore(scope);
    const readModel = new InMemoryReadModelStore(scope);
    const app = createLedgerApplication({
      eventStore,
      readModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog: new SeedCurrencyCatalog(),
    });

    return { bus: app.commandBus, readModel, eventStore };
  }

  const dryRunCtx = (): AuthContext => ({ ...ctx(), dryRun: true });

  it('previews a transaction without persisting events or projections (AC-2, AC-3)', async () => {
    const { bus, readModel, eventStore } = dryRunSetup();
    await bus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx());
    const { expenses, assets } = await openTwoAccounts(bus);
    const command = new RecordTransactionCommand(
      '2026-07-20',
      'Netflix',
      'Monthly subscription',
      [
        { accountId: expenses, amount: '31900', currency: 'COP' },
        { accountId: assets, amount: '-31900', currency: 'COP' },
      ],
      TransactionStatus.PENDING,
    );

    const preview = await bus.dispatch(command, dryRunCtx());

    expect(preview.aggregateId).toBeTruthy();
    expect(preview.streamPosition).toBeGreaterThan(0n);
    expect(await eventStore.readAll(0n, 100)).toEqual([]);
    expect(
      await readModel.query(PROJ_TRANSACTIONS, Criteria.none().equals('user_id', 'user-1')),
    ).toEqual([]);
  });

  it('keeps a subsequent real run valid after a preview (AC-2)', async () => {
    const { bus, readModel, eventStore } = dryRunSetup();
    await bus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx());
    const { expenses, assets } = await openTwoAccounts(bus);
    const command = new RecordTransactionCommand(
      '2026-07-20',
      'Netflix',
      'Monthly subscription',
      [
        { accountId: expenses, amount: '31900', currency: 'COP' },
        { accountId: assets, amount: '-31900', currency: 'COP' },
      ],
      TransactionStatus.PENDING,
    );

    await bus.dispatch(command, dryRunCtx());
    const real = await bus.dispatch(command, ctx());

    expect(real.aggregateId).toBeTruthy();
    expect(await eventStore.readAll(0n, 100)).toHaveLength(3); // initialize + 2 accounts + txn
    const [row] = await readModel.query<{ derived_kind: string }>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', real.aggregateId),
    );
    expect(row.derived_kind).toBe('EXPENSE');
  });

  it('propagates domain failures during a preview without side effects (AC-2)', async () => {
    const { bus, eventStore } = dryRunSetup();
    await bus.dispatch(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx());
    const { expenses, assets } = await openTwoAccounts(bus);

    await expect(
      bus.dispatch(
        new RecordTransactionCommand(
          '2026-07-20',
          null,
          'Broken',
          [
            { accountId: expenses, amount: '31900', currency: 'COP' },
            { accountId: assets, amount: '-31000', currency: 'COP' },
          ],
          TransactionStatus.PENDING,
        ),
        dryRunCtx(),
      ),
    ).rejects.toBeInstanceOf(UnbalancedTransactionException);

    expect(await eventStore.readAll(0n, 100)).toEqual([]);
  });
});

describe('Retry on transient failures (in-memory composition, hu-0025)', () => {
  it('retries a transient append failure and succeeds (AC-5)', async () => {
    const { bus } = setup();
    const { expenses, assets } = await openTwoAccounts(bus);
    const append = jest
      .spyOn(eventStoreFor(bus), 'append')
      .mockImplementationOnce(async () => { throw new TransientPersistenceException('deadlock'); })
      .mockImplementationOnce(async () => { throw new TransientPersistenceException('deadlock'); });

    const result = await bus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Netflix',
        'Sub',
        [
          { accountId: expenses, amount: '31900', currency: 'COP' },
          { accountId: assets, amount: '-31900', currency: 'COP' },
        ],
        TransactionStatus.PENDING,
      ),
      ctx(),
    );

    expect(result.aggregateId).toBeTruthy();
    expect(append).toHaveBeenCalledTimes(3);

    append.mockRestore();
  });

  it('surfaces PERSISTENCE_CONFLICT once the retry budget is exhausted (AC-5)', async () => {
    const { bus } = setup();
    const { expenses, assets } = await openTwoAccounts(bus);
    const append = jest
      .spyOn(eventStoreFor(bus), 'append')
      .mockImplementation(async () => { throw new TransientPersistenceException('deadlock'); });

    await expect(
      bus.dispatch(
        new RecordTransactionCommand(
          '2026-07-20',
          'Netflix',
          'Sub',
          [
            { accountId: expenses, amount: '31900', currency: 'COP' },
            { accountId: assets, amount: '-31900', currency: 'COP' },
          ],
          TransactionStatus.PENDING,
        ),
        ctx(),
      ),
    ).rejects.toBeInstanceOf(PersistenceConflictException);

    expect(append).toHaveBeenCalledTimes(3);

    append.mockRestore();
  });
});
```

> `eventStoreFor(bus)` es un helper local que expone el event store usado por `setup()`:
> modificar `setup()` para que retorne también `eventStore` (ya lo retorna) y usar
> `const { bus, eventStore } = setup()` en los tests de retry (ajustar según el helper
> real del archivo). El `retryWait` real duerme 10–70 ms por reintento — aceptable; si
> el suite se vuelve lenta, pasar `retryWait: async () => undefined` en `createLedgerApplication`.

**Step 2: Ejecutar** → FAIL (la cadena no tiene las policies nuevas: dry-run persiste,
retry no existe).

**Step 3: Implementar**

`ledger-application.factory.ts` — deps opcionales + chain:

```typescript
import { DryRunPolicy } from '@cqrs/application/command-bus/policies/dry-run.policy';
import { RetryCounter, NoopRetryCounter } from '@cqrs/application/command-bus/policies/retry-counter';
import { RetryPolicy } from '@cqrs/application/command-bus/policies/retry.policy';
```

En `LedgerApplicationDeps`:

```typescript
  /**
   * Metric sink for transient retries (AC-8). Defaults to a no-op for
   * compositions that do not observe (tests); the Nest wiring provides the
   * OTel-backed counter.
   */
  readonly retryCounter?: RetryCounter;
  /**
   * Delay between retry attempts. Defaults to the real exponential backoff
   * with jitter; tests inject a no-op to keep the suite fast.
   */
  readonly retryWait?: (ms: number) => Promise<void>;
```

En `createLedgerApplication`:

```typescript
  const commandBus = new PolicyCommandBus([
    new AuthenticatedContextPolicy(),
    new RetryPolicy(deps.retryCounter ?? new NoopRetryCounter(), deps.retryWait),
    new IdempotencyPolicy(eventStore),
    new OptimisticConcurrencyPolicy(),
    new DryRunPolicy(eventStore),
  ]);
```

`ledger-core.module.ts`:

```typescript
import { RetryCounter } from '@cqrs/application/command-bus/policies/retry-counter';
import { OtelRetryCounter } from '@cqrs/infrastructure/adapters/telemetry/otel-retry-counter';
import { PostgresTransactionScope } from '@cqrs/infrastructure/adapters/transaction/postgres-transaction.scope';
```

- Agregar provider: `{ provide: PostgresTransactionScope, useClass: PostgresTransactionScope }`.
- `EventStore`/`ReadModelStore` siguen con `useClass` (Nest inyecta el scope por parámetro).
- Agregar provider: `{ provide: RetryCounter, useClass: OtelRetryCounter }`.
- En la factory del `PolicyCommandBus`: inyectar `RetryCounter` y pasarlo:
  `createLedgerApplication({ ..., retryCounter })` y `retryWait: undefined` (default real).

**Step 4: Ejecutar**

```bash
npx jest apps/ledger/src/bootstrap --no-coverage
```
Esperado: PASS (composición + dry-run + retry + todos los casos existentes).

---

### Tarea 13: `PERSISTENCE_CONFLICT` en el registro de códigos + mapping contract test [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared/domain/errors/ledger-error-code.ts`
- Modificar: `apps/ledger/src/shared/infrastructure/adapters/http/ledger-error-code-mapping.spec.ts`

**Step 1: Test que falla**

En `ledger-error-code-mapping.spec.ts`, agregar la fila del contract test tabular:

```typescript
{
  exception: () => new PersistenceConflictException('exhausted'),
  status: 409,
  code: 'PERSISTENCE_CONFLICT',
},
```

(import de `PersistenceConflictException` desde `@cqrs/domain/exceptions/persistence-conflict.exception`.)
Seguir exactamente la forma de las filas existentes del spec (ver cómo se declaran las
columnas de la tabla del describe).

**Step 2: Ejecutar** → FAIL (el code no está en `LEDGER_ERROR_CODE` ni la fila en la tabla).

**Step 3: Implementar**

En `ledger-error-code.ts`, en el grupo de 409 (junto a `CONCURRENCY_CONFLICT`):

```typescript
  /** hu-0025: retry budget agotado ante fallo transitorio del motor (40P01/40001). */
  PERSISTENCE_CONFLICT: 'PERSISTENCE_CONFLICT',
```

Ajustar al formato exacto del const existente (mirar cómo declara `CONCURRENCY_CONFLICT`).

**Step 4: Ejecutar**

```bash
npx jest apps/ledger/src/shared/infrastructure/adapters/http --no-coverage
```
Esperado: PASS.

---

### Tarea 14: Suites completas + lint [X]

**Step 1: Suite de libs/cqrs**

```bash
npx jest libs/cqrs --no-coverage
```
Esperado: PASS.

**Step 2: Suite de apps/ledger**

```bash
npx jest apps/ledger --no-coverage
```
Esperado: PASS.

**Step 3: Lint + build de los proyectos afectados**

```bash
npx nx run-many -t lint,build --projects=ledger,cqrs --skip-nx-cache
```
Esperado: LINT SUCCESS y BUILD SUCCESS para ambos.

> Si el lint marca `@opentelemetry/api` como dependencia no declarada de `libs/cqrs`,
> agregarla a `libs/cqrs/package.json` (Tarea 8) y re-correr.
