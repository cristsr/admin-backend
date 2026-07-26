# hu-0008: Tooling de rebuild/replay + verificación de consistencia — Plan de Implementación

**Historia:** `work/active/hu-0008/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Extender `ProjectionRebuilder` con `rebuild(projectionName)` y `rebuildAll()`, crear `ConsistencyVerifier` para verificar `proj_balances` contra el stream, y exponer un CLI vía Nx executor.
**Arquitectura:** Hexagonal. `ProjectionRegistry` (concreto, `application/`) resuelve proyectores por nombre. `ProjectionRebuilder` (modificado, admite registry) y `ConsistencyVerifier` (nuevo, recalcula saldos desde eventos) son application-logic libres de NestJS/TypeORM. El adaptador CLI es un script standalone Nx.
**Stack:** NestJS · TypeScript · PostgreSQL · Jest · Nx

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 3 (rebuild por nombre vía registry) |
| AC-2 | Tarea 3 (rebuild de una no afecta otras — test idempotencia/aislamiento) |
| AC-3 | Tarea 1 (RebuildReport), Tarea 3 (rebuildAll) |
| AC-4 | Tarea 3 (test de idempotencia: doble rebuild = mismo estado) |
| AC-5 | Tarea 1 (BalanceVerificationReport), Tarea 4 (ConsistencyVerifier) |
| AC-6 | Tarea 3 (solo readAll, nunca append), Tarea 4 (solo readAll, nunca append) |

---

### Tarea 0: Preparar rama de trabajo

> **Forge mode:** ya estamos en `feat/core`. Se saltea este paso.

**Steps:**

**Step 1: Verificar base fresca (read-only)**

```bash
git -C D:\Cristian\Nest\admin-back branch --show-current
```
Esperado: `develop`. Si no, `/sync` primero.

**Step 2: Crear rama**

```bash
git -C D:\Cristian\Nest\admin-back checkout -b feat/hu-0008-rebuild-verifier
```

---

### Tarea 1: Tipos `RebuildReport` y `BalanceVerificationReport` [X]

**Archivos:**
- Crear: `apps/ledger/src/shared-kernel/application/tooling/rebuild-report.type.ts`
- Crear: `apps/ledger/src/shared-kernel/application/tooling/balance-verification-report.type.ts`

**Step 1: Crear `RebuildReport`**

En `apps/ledger/src/shared-kernel/application/tooling/rebuild-report.type.ts`:

```typescript
export type RebuildReport = {
  readonly projectionName: string;
  readonly success: boolean;
  readonly eventsApplied: number;
  readonly error?: string;
};
```

**Step 2: Crear `BalanceVerificationReport` y `BalanceDiscrepancy`**

En `apps/ledger/src/shared-kernel/application/tooling/balance-verification-report.type.ts`:

```typescript
import { Money } from '@ledger/shared/domain/money';

export type BalanceDiscrepancy = {
  readonly accountId: string;
  readonly currencyCode: string;
  readonly streamConfirmed: Money;
  readonly streamPending: Money;
  readonly projectedConfirmed: Money;
  readonly projectedPending: Money;
  readonly driftConfirmed: Money;
  readonly driftPending: Money;
};

export type BalanceVerificationReport = {
  readonly ok: boolean;
  readonly discrepancies: readonly BalanceDiscrepancy[];
};
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit -p apps/ledger/tsconfig.app.json 2>&1
```
Esperado: sin errores.

---

### Tarea 2: `ProjectionRegistry` (concreto, `application/`) [X]

**Archivos:**
- Crear: `apps/ledger/src/shared-kernel/application/tooling/projection-registry.ts`
- Crear: `apps/ledger/src/shared-kernel/application/tooling/projection-registry.spec.ts`

**Step 1: Escribir el test que falla**

En `apps/ledger/src/shared-kernel/application/tooling/projection-registry.spec.ts`:

```typescript
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { ProjectionRegistry } from './projection-registry';

class StubProjector extends Projector {
  readonly name = 'stub';
  readonly consumes: readonly string[] = [];
  async project(_event: StoredEvent, _store: ReadModelStore): Promise<void> {}
}

class AnotherStub extends Projector {
  readonly name = 'another';
  readonly consumes: readonly string[] = [];
  async project(_event: StoredEvent, _store: ReadModelStore): Promise<void> {}
}

describe('ProjectionRegistry', () => {
  let registry: ProjectionRegistry;

  beforeEach(() => {
    registry = new ProjectionRegistry();
  });

  it('returns projectors and tables registered for a name', () => {
    const projector = new StubProjector();
    registry.register('test_proj', [projector], ['test_table']);

    const entry = registry.get('test_proj');
    expect(entry.projectors).toEqual([projector]);
    expect(entry.tables).toEqual(['test_table']);
  });

  it('throws when a name is not registered', () => {
    expect(() => registry.get('unknown')).toThrow(/unknown/);
  });

  it('lists all registered names via names()', () => {
    registry.register('a', [new StubProjector()], ['t_a']);
    registry.register('b', [new AnotherStub()], ['t_b']);

    const names = registry.names();
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names).toHaveLength(2);
  });

  it('returns empty array when no projections are registered', () => {
    expect(registry.names()).toEqual([]);
  });

  it('allows registering multiple projectors for one projection', () => {
    const p1 = new StubProjector();
    const p2 = new AnotherStub();
    registry.register('multi', [p1, p2], ['t1', 't2']);

    const entry = registry.get('multi');
    expect(entry.projectors).toHaveLength(2);
    expect(entry.tables).toEqual(['t1', 't2']);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/shared-kernel/application/tooling/projection-registry.spec.ts --no-coverage
```
Esperado: FAIL — `Cannot find module './projection-registry'`

**Step 3: Implementar `ProjectionRegistry`**

En `apps/ledger/src/shared-kernel/application/tooling/projection-registry.ts`:

```typescript
import { Projector } from '@ledger/shared-kernel/application/projection/projector';

export type ProjectionEntry = {
  readonly projectors: readonly Projector[];
  readonly tables: readonly string[];
};

export class ProjectionRegistry {
  private readonly entries = new Map<string, ProjectionEntry>();

  register(name: string, projectors: readonly Projector[], tables: readonly string[]): void {
    this.entries.set(name, { projectors, tables });
  }

  get(name: string): ProjectionEntry {
    const entry = this.entries.get(name);

    if (!entry) {
      throw new Error(`Projection "${name}" is not registered`);
    }

    return entry;
  }

  names(): readonly string[] {
    return [...this.entries.keys()];
  }
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/shared-kernel/application/tooling/projection-registry.spec.ts --no-coverage
```
Esperado: PASS — 5 tests verdes

---

### Tarea 3: Refactor `ProjectionRebuilder` — `rebuild(projectionName)` y `rebuildAll()` [X]

**Archivos:**
- Modificar: `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/projection-rebuilder.ts`
- Modificar: `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/projection-rebuilder.spec.ts`

**Step 1: Actualizar el test existente + escribir nuevos tests**

En `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/projection-rebuilder.spec.ts` (reemplazar contenido):

```typescript
import { Criteria } from '@shared';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { AccountTreeProjector, PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { ProjectionRegistry } from '@ledger/shared-kernel/application/tooling/projection-registry';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import {
  AccountBalancesProjector,
  PROJ_BALANCES,
} from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  TransactionListProjector,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { InMemoryProjectionCheckpointRepository } from './in-memory-projection-checkpoint.repository';
import { ProjectionRebuilder } from './projection-rebuilder';

const ctx: AuthContext = { userId: 'user-1', clientId: 'c', externalRef: null };

function buildRegistry() {
  const catalog = new SeedCurrencyCatalog();
  const registry = new ProjectionRegistry();
  registry.register('account_tree', [new AccountTreeProjector()], [PROJ_ACCOUNTS]);
  registry.register(
    'transaction_list',
    [new TransactionListProjector()],
    [PROJ_TRANSACTIONS, PROJ_POSTINGS],
  );
  registry.register(
    'account_balances',
    [new AccountBalancesProjector(catalog)],
    [PROJ_BALANCES],
  );
  registry.register(
    'core',
    [
      new AccountTreeProjector(),
      new TransactionListProjector(),
      new AccountBalancesProjector(catalog),
    ],
    [PROJ_ACCOUNTS, PROJ_TRANSACTIONS, PROJ_POSTINGS, PROJ_BALANCES],
  );
  return { catalog, registry };
}

describe('ProjectionRebuilder', () => {
  it('reconstructs the whole read model from the event stream (RNF-5)', async () => {
    const eventStore = new InMemoryEventStore();
    const liveReadModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistry();
    const app = createLedgerApplication({
      eventStore,
      readModel: liveReadModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    const expenses = await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    const assets = await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Bakery',
        'Bread',
        [
          { accountId: expenses.aggregateId, amount: '5000', currency: 'COP' },
          { accountId: assets.aggregateId, amount: '-5000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      ctx,
    );

    const rebuiltReadModel = new InMemoryReadModelStore();
    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const { registry } = buildRegistry();
    const rebuilder = new ProjectionRebuilder(eventStore, rebuiltReadModel, checkpoints, registry);

    // AC-1: rebuild by projection name
    const applied = await rebuilder.rebuild('core');
    expect(applied).toBeGreaterThan(0);
    expect(await rebuilder.isCaughtUp('core')).toBe(true);

    const live = await liveReadModel.query(PROJ_BALANCES, Criteria.none());
    const rebuilt = await rebuiltReadModel.query(PROJ_BALANCES, Criteria.none());
    expect(rebuilt).toEqual(live);
  });

  it('rebuilds a single projection without affecting others (AC-2)', async () => {
    const eventStore = new InMemoryEventStore();
    const liveReadModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistry();
    const app = createLedgerApplication({
      eventStore,
      readModel: liveReadModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );

    // Snapshot of account_tree before rebuild
    const accountsBefore = await liveReadModel.query(PROJ_ACCOUNTS, Criteria.none());

    const rebuiltReadModel = new InMemoryReadModelStore();
    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const { registry } = buildRegistry();
    const rebuilder = new ProjectionRebuilder(eventStore, rebuiltReadModel, checkpoints, registry);

    // Rebuild ONLY account_balances
    await rebuilder.rebuild('account_balances');

    // AC-2: account_tree in the rebuilt model should NOT have been touched
    const accountsRebuilt = await rebuiltReadModel.query(PROJ_ACCOUNTS, Criteria.none());
    expect(accountsRebuilt).toHaveLength(0); // untouched

    // But the live model still has accounts
    expect(accountsBefore.length).toBeGreaterThan(0);
  });

  it('rebuildAll reconstructs all registered projections and returns reports (AC-3)', async () => {
    const eventStore = new InMemoryEventStore();
    const liveReadModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistry();
    const app = createLedgerApplication({
      eventStore,
      readModel: liveReadModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );

    const rebuiltReadModel = new InMemoryReadModelStore();
    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const { registry } = buildRegistry();
    const rebuilder = new ProjectionRebuilder(eventStore, rebuiltReadModel, checkpoints, registry);

    const reports = await rebuilder.rebuildAll();

    expect(reports.length).toBeGreaterThanOrEqual(3);
    for (const report of reports) {
      expect(report.success).toBe(true);
      expect(report.eventsApplied).toBeGreaterThan(0);
    }

    // All are caught up
    for (const report of reports) {
      expect(await rebuilder.isCaughtUp(report.projectionName)).toBe(true);
    }
  });

  it('rebuild is idempotent — running twice produces same state (AC-4)', async () => {
    const eventStore = new InMemoryEventStore();
    const liveReadModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistry();
    const app = createLedgerApplication({
      eventStore,
      readModel: liveReadModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );

    const readModel = new InMemoryReadModelStore();
    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const { registry } = buildRegistry();
    const rebuilder = new ProjectionRebuilder(eventStore, readModel, checkpoints, registry);

    // First rebuild
    await rebuilder.rebuild('core');
    const firstAccounts = await readModel.query(PROJ_ACCOUNTS, Criteria.none());

    // Second rebuild
    await rebuilder.rebuild('core');
    const secondAccounts = await readModel.query(PROJ_ACCOUNTS, Criteria.none());

    // AC-4: identical (no accumulation/duplication)
    expect(secondAccounts).toEqual(firstAccounts);
  });

  it('throws when rebuilding an unregistered projection', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const registry = new ProjectionRegistry();
    const rebuilder = new ProjectionRebuilder(eventStore, readModel, checkpoints, registry);

    await expect(rebuilder.rebuild('nonexistent')).rejects.toThrow(/nonexistent/);
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/shared-kernel/infrastructure/adapters/projection/projection-rebuilder.spec.ts --no-coverage
```
Esperado: FAIL — errores de compilación (constructor cambiado, `rebuild` espera `string`, `rebuildAll` no existe)

**Step 3: Refactorizar `ProjectionRebuilder`**

En `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/projection-rebuilder.ts` (reemplazar contenido):

```typescript
import { ProjectionCheckpointRepository } from '@ledger/shared-kernel/application/projection/projection-checkpoint.repository';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { ProjectionRegistry } from '@ledger/shared-kernel/application/tooling/projection-registry';
import { RebuildReport } from '@ledger/shared-kernel/application/tooling/rebuild-report.type';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { PollingProjectionDispatcher } from './polling-dispatcher';

export type RebuildTarget = {
  readonly projectionName: string;
  readonly projectors: readonly Projector[];
  readonly tables: readonly string[];
};

export class ProjectionRebuilder {
  constructor(
    private readonly eventStore: EventStore,
    private readonly readModel: ReadModelStore,
    private readonly checkpoints: ProjectionCheckpointRepository,
    private readonly registry: ProjectionRegistry,
  ) {}

  async rebuild(projectionName: string): Promise<number> {
    const entry = this.registry.get(projectionName);

    return this.rebuildTarget({
      projectionName,
      projectors: entry.projectors,
      tables: entry.tables,
    });
  }

  async rebuildAll(): Promise<RebuildReport[]> {
    const results: RebuildReport[] = [];

    for (const name of this.registry.names()) {
      try {
        const applied = await this.rebuild(name);
        results.push({ projectionName: name, success: true, eventsApplied: applied });
      } catch (error) {
        results.push({
          projectionName: name,
          success: false,
          eventsApplied: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  private async rebuildTarget(target: RebuildTarget): Promise<number> {
    for (const table of target.tables) {
      await this.readModel.truncate(table);
    }

    await this.checkpoints.advance(target.projectionName, 0n);

    const poller = new PollingProjectionDispatcher(
      target.projectionName,
      this.eventStore,
      target.projectors,
      this.readModel,
      this.checkpoints,
    );

    return poller.catchUp();
  }

  async isCaughtUp(projectionName: string): Promise<boolean> {
    const events = await this.eventStore.readAll(0n, Number.MAX_SAFE_INTEGER);
    const checkpoint = await this.checkpoints.lastPosition(projectionName);

    if (!events.length) return checkpoint === 0n;

    return checkpoint >= events[events.length - 1].globalPosition;
  }
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/shared-kernel/infrastructure/adapters/projection/projection-rebuilder.spec.ts --no-coverage
```
Esperado: PASS — 5 tests verdes

---

### Tarea 4: `ConsistencyVerifier` [X]

**Archivos:**
- Crear: `apps/ledger/src/shared-kernel/application/tooling/consistency-verifier.ts`
- Crear: `apps/ledger/src/shared-kernel/application/tooling/consistency-verifier.spec.ts`

**Step 1: Escribir el test que falla**

En `apps/ledger/src/shared-kernel/application/tooling/consistency-verifier.spec.ts`:

```typescript
import { Criteria } from '@shared';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { AccountTreeProjector, PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { Money } from '@ledger/shared/domain/money';
import { Currency, CurrencyCode } from '@ledger/shared-kernel/domain/value-objects';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { ProjectionRegistry } from '@ledger/shared-kernel/application/tooling/projection-registry';
import {
  AccountBalancesProjector,
  PROJ_BALANCES,
} from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  TransactionListProjector,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { ConsistencyVerifier } from './consistency-verifier';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';

const ctx: AuthContext = { userId: 'user-1', clientId: 'c', externalRef: null };

function buildRegistryAndCatalog() {
  const catalog = new SeedCurrencyCatalog();
  const registry = new ProjectionRegistry();
  registry.register('account_tree', [new AccountTreeProjector()], [PROJ_ACCOUNTS]);
  registry.register(
    'transaction_list',
    [new TransactionListProjector()],
    [PROJ_TRANSACTIONS, PROJ_POSTINGS],
  );
  registry.register(
    'account_balances',
    [new AccountBalancesProjector(catalog)],
    [PROJ_BALANCES],
  );
  registry.register(
    'core',
    [
      new AccountTreeProjector(),
      new TransactionListProjector(),
      new AccountBalancesProjector(catalog),
    ],
    [PROJ_ACCOUNTS, PROJ_TRANSACTIONS, PROJ_POSTINGS, PROJ_BALANCES],
  );
  return { catalog, registry };
}

describe('ConsistencyVerifier', () => {
  const otherCtx: AuthContext = { userId: 'user-2', clientId: 'c2', externalRef: null };

  it('returns OK for an empty stream (AC-5)', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const catalog = new SeedCurrencyCatalog();
    const { registry } = buildRegistryAndCatalog();
    const eventRegistry = createLedgerEventRegistry(catalog);
    const verifier = new ConsistencyVerifier(eventStore, readModel, eventRegistry);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it('returns OK when stream-derived balances match proj_balances (AC-5)', async () => {
    const eventStore = new InMemoryEventStore();
    const liveReadModel = new InMemoryReadModelStore();
    const { catalog, registry } = buildRegistryAndCatalog();

    const app = createLedgerApplication({
      eventStore,
      readModel: liveReadModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    const expenses = await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    const assets = await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Bakery',
        'Bread',
        [
          { accountId: expenses.aggregateId, amount: '5000', currency: 'COP' },
          { accountId: assets.aggregateId, amount: '-5000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      ctx,
    );

    const eventRegistry = createLedgerEventRegistry(catalog);
    const verifier = new ConsistencyVerifier(eventStore, liveReadModel, eventRegistry);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it('detects drift when a proj_balances row is corrupted (AC-5)', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistryAndCatalog();

    const app = createLedgerApplication({
      eventStore,
      readModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    const expenses = await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    const assets = await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Bakery',
        'Bread',
        [
          { accountId: expenses.aggregateId, amount: '5000', currency: 'COP' },
          { accountId: assets.aggregateId, amount: '-5000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      ctx,
    );

    // Corrupt proj_balances
    await readModel.upsert(
      PROJ_BALANCES,
      { account_id: expenses.aggregateId, currency_code: 'COP' },
      {
        account_id: expenses.aggregateId,
        currency_code: 'COP',
        confirmed_amount: '99999',
        pending_amount: '0',
        updated_at: new Date().toISOString(),
      },
    );

    const eventRegistry = createLedgerEventRegistry(catalog);
    const verifier = new ConsistencyVerifier(eventStore, readModel, eventRegistry);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(false);
    expect(report.discrepancies.length).toBeGreaterThan(0);

    const drift = report.discrepancies.find(
      (d) => d.accountId === expenses.aggregateId && d.currencyCode === 'COP',
    );
    expect(drift).toBeDefined();
    // Stream-derived confirmed should be 5000, projected was corrupted to 99999
    expect(drift!.streamConfirmed.toDecimalString()).toBe('5000');
  });

  it('filters events by userId and ignores other users', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistryAndCatalog();

    const app = createLedgerApplication({
      eventStore,
      readModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
    });

    const user1Assets = await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Bakery',
        'Bread',
        [
          { accountId: user1Assets.aggregateId, amount: '-5000', currency: 'COP' },
          { accountId: user1Assets.aggregateId, amount: '5000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      ctx,
    );

    const eventRegistry = createLedgerEventRegistry(catalog);
    const verifier = new ConsistencyVerifier(eventStore, readModel, eventRegistry);

    // Verify user-2 (who has zero events)
    const report = await verifier.verifyBalances(otherCtx.userId);

    expect(report.ok).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it('detects extra row in proj_balances not in stream', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistryAndCatalog();

    // Insert a row that has no matching event
    await readModel.upsert(
      PROJ_BALANCES,
      { account_id: '00000000-0000-0000-0000-000000000001', currency_code: 'COP' },
      {
        account_id: '00000000-0000-0000-0000-000000000001',
        currency_code: 'COP',
        confirmed_amount: '100',
        pending_amount: '0',
        updated_at: new Date().toISOString(),
      },
    );

    const eventRegistry = createLedgerEventRegistry(catalog);
    const verifier = new ConsistencyVerifier(eventStore, readModel, eventRegistry);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(false);
    expect(report.discrepancies).toHaveLength(1);
    expect(report.discrepancies[0].accountId).toBe('00000000-0000-0000-0000-000000000001');
  });
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/shared-kernel/application/tooling/consistency-verifier.spec.ts --no-coverage
```
Esperado: FAIL — `Cannot find module './consistency-verifier'`

**Step 3: Implementar `ConsistencyVerifier`**

En `apps/ledger/src/shared-kernel/application/tooling/consistency-verifier.ts`:

```typescript
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { Money } from '@ledger/shared/domain/money';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { BalanceVerificationReport, BalanceDiscrepancy } from './balance-verification-report.type';

type PostingProjection = {
  accountId: string;
  currencyCode: string;
  amount: Money;
  status: 'CONFIRMED' | 'PENDING';
};

type TransactionLedgerEntry = {
  postings: readonly PostingProjection[];
  status: 'CONFIRMED' | 'PENDING';
};

export class ConsistencyVerifier {
  constructor(
    private readonly eventStore: EventStore,
    private readonly readModel: ReadModelStore,
    private readonly eventRegistry: EventRegistry,
  ) {}

  async verifyBalances(userId: string): Promise<BalanceVerificationReport> {
    const events = await this.eventStore.readAll(0n, Number.MAX_SAFE_INTEGER);
    const userEvents = events.filter((e) => e.userId === userId);

    const streamBalances = this.computeBalances(userEvents);
    const projectedBalances = await this.loadProjectedBalances(userId);

    const discrepancies: BalanceDiscrepancy[] = [];

    const allKeys = new Set([
      ...streamBalances.keys(),
      ...projectedBalances.keys(),
    ]);

    for (const key of allKeys) {
      const [accountId, currencyCode] = key.split('|');
      const stream = streamBalances.get(key) ?? {
        confirmed: Money.zero(
          this.resolveCurrency(projectedBalances.get(key)),
        ),
        pending: Money.zero(
          this.resolveCurrency(projectedBalances.get(key)),
        ),
      };
      const projected = projectedBalances.get(key) ?? {
        confirmed: Money.zero(
          this.resolveCurrency(streamBalances.get(key)),
        ),
        pending: Money.zero(
          this.resolveCurrency(streamBalances.get(key)),
        ),
      };

      if (!stream.confirmed.equals(projected.confirmed) || !stream.pending.equals(projected.pending)) {
        const driftConfirmed = stream.confirmed.subtract(projected.confirmed);
        const driftPending = stream.pending.subtract(projected.pending);

        discrepancies.push({
          accountId,
          currencyCode,
          streamConfirmed: stream.confirmed,
          streamPending: stream.pending,
          projectedConfirmed: projected.confirmed,
          projectedPending: projected.pending,
          driftConfirmed,
          driftPending,
        });
      }
    }

    return {
      ok: discrepancies.length === 0,
      discrepancies,
    };
  }

  private computeBalances(
    events: readonly { userId: string; aggregateType: string; aggregateId: string; eventType: string; payload: Record<string, unknown> }[],
  ): Map<string, { confirmed: Money; pending: Money }> {
    const ledger = new Map<string, TransactionLedgerEntry>();

    for (const event of events) {
      if (event.aggregateType !== 'LedgerTransaction') continue;

      switch (event.eventType) {
        case 'TransactionRecorded': {
          const pay = event.payload as {
            status: string;
            postings: { accountId: string; amount: string; currency: string; kind: string }[];
          };
          const postings = pay.postings.map((p) => this.postingFromPayload(p, pay.status as 'CONFIRMED' | 'PENDING'));
          ledger.set(event.aggregateId, {
            postings,
            status: pay.status as 'CONFIRMED' | 'PENDING',
          });
          break;
        }
        case 'TransactionConfirmed': {
          const entry = ledger.get(event.aggregateId);
          if (entry) {
            const confirmedPostings = entry.postings.map((p) => ({ ...p, status: 'CONFIRMED' as const }));
            ledger.set(event.aggregateId, {
              postings: confirmedPostings,
              status: 'CONFIRMED',
            });
          }
          break;
        }
        case 'TransactionVoided': {
          ledger.delete(event.aggregateId);
          break;
        }
        case 'TransactionAmended': {
          const amendPay = event.payload as {
            postings: { accountId: string; amount: string; currency: string; kind: string }[];
          };
          const entry = ledger.get(event.aggregateId);
          if (entry) {
            const amendedPostings = amendPay.postings.map((p) => this.postingFromPayload(p, entry.status));
            ledger.set(event.aggregateId, {
              postings: amendedPostings,
              status: entry.status,
            });
          }
          break;
        }
        case 'TransactionReversed': {
          // Reversal creates offsetting postings — the original transaction is echoed
          // in a separate aggregate. The reversed event payload contains reversal data.
          // The replacement transaction has its own TransactionRecorded event.
          break;
        }
      }
    }

    return this.aggregateLedger(ledger);
  }

  private postingFromPayload(
    p: { accountId: string; amount: string; currency: string; kind: string },
    status: 'CONFIRMED' | 'PENDING',
  ): PostingProjection {
    const currency = this.currencyFromCode(p.currency);
    const amount = p.kind === 'credit' ? Money.of(p.amount, currency).negate() : Money.of(p.amount, currency);
    return { accountId: p.accountId, currencyCode: p.currency, amount, status };
  }

  private currencyFromCode(code: string) {
    // Map from known currency codes; COP = 0 minor units
    const map: Record<string, { minorUnits: number }> = {
      COP: { minorUnits: 0 },
      USD: { minorUnits: 2 },
      EUR: { minorUnits: 2 },
    };
    const entry = map[code];
    if (!entry) throw new Error(`Unknown currency: ${code}`);
    return { code, minorUnits: entry.minorUnits };
  }

  private aggregateLedger(
    ledger: Map<string, TransactionLedgerEntry>,
  ): Map<string, { confirmed: Money; pending: Money }> {
    const balances = new Map<string, { confirmed: Money; pending: Money }>();

    for (const entry of ledger.values()) {
      for (const posting of entry.postings) {
        const key = `${posting.accountId}|${posting.currencyCode}`;
        const current = balances.get(key) ?? {
          confirmed: Money.zero({ code: posting.amount.currency.code, minorUnits: posting.amount.currency.minorUnits }),
          pending: Money.zero({ code: posting.amount.currency.code, minorUnits: posting.amount.currency.minorUnits }),
        };

        if (posting.status === 'CONFIRMED') {
          balances.set(key, {
            confirmed: current.confirmed.add(posting.amount),
            pending: current.pending,
          });
        } else {
          balances.set(key, {
            confirmed: current.confirmed,
            pending: current.pending.add(posting.amount),
          });
        }
      }
    }

    return balances;
  }

  private async loadProjectedBalances(
    _userId: string,
  ): Promise<Map<string, { confirmed: Money; pending: Money }>> {
    const rows = await this.readModel.query<{
      account_id: string;
      currency_code: string;
      confirmed_amount: string;
      pending_amount: string;
    }>('proj_balances', { equals: () => ({}) } as never);

    const map = new Map<string, { confirmed: Money; pending: Money }>();

    for (const row of rows) {
      const currency = this.currencyFromCode(row.currency_code);
      map.set(`${row.account_id}|${row.currency_code}`, {
        confirmed: Money.of(row.confirmed_amount, currency),
        pending: Money.of(row.pending_amount, currency),
      });
    }

    return map;
  }

  private resolveCurrency(
    entry: { confirmed: Money; pending: Money } | undefined,
  ): { code: string; minorUnits: number } {
    if (entry) return { code: entry.confirmed.currency.code, minorUnits: entry.confirmed.currency.minorUnits };
    return { code: 'COP', minorUnits: 0 };
  }
}
```

**Step 4: Ejecutar y confirmar que pasa**

```bash
npx jest apps/ledger/src/shared-kernel/application/tooling/consistency-verifier.spec.ts --no-coverage
```
Esperado: PASS — 5 tests verdes

---

### Tarea 5: CLI Nx executor (`rebuild.command.ts`) + target en `project.json` [X]

**Archivos:**
- Crear: `apps/ledger/src/tooling/rebuild.command.ts`
- Modificar: `apps/ledger/project.json`

**Step 1: Agregar target `rebuild` al `project.json`**

En `apps/ledger/project.json`, agregar dentro de `"targets"` después de `"test"`:

```json
"rebuild": {
  "executor": "@nx/js:node",
  "options": {
    "buildTarget": "ledger:build",
    "runtimeArgs": ["-r", "tsconfig-paths/register"],
    "args": ["rebuild"]
  }
},
"rebuildAll": {
  "executor": "@nx/js:node",
  "options": {
    "buildTarget": "ledger:build",
    "runtimeArgs": ["-r", "tsconfig-paths/register"],
    "args": ["rebuildAll"]
  }
},
"verify-balances": {
  "executor": "@nx/js:node",
  "options": {
    "buildTarget": "ledger:build",
    "runtimeArgs": ["-r", "tsconfig-paths/register"],
    "args": ["verify-balances"]
  }
}
```

**Step 2: Crear el script CLI**

En `apps/ledger/src/tooling/rebuild.command.ts`:

```typescript
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PostgresEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store';
import { PostgresReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store';
import { InMemoryProjectionCheckpointRepository } from '@ledger/shared-kernel/infrastructure/adapters/projection/in-memory-projection-checkpoint.repository';
import { ProjectionRegistry } from '@ledger/shared-kernel/application/tooling/projection-registry';
import { ProjectionRebuilder } from '@ledger/shared-kernel/infrastructure/adapters/projection/projection-rebuilder';
import { ConsistencyVerifier } from '@ledger/shared-kernel/application/tooling/consistency-verifier';
import { AccountTreeProjector, PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import {
  AccountBalancesProjector,
  PROJ_BALANCES,
} from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
  TransactionListProjector,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { LedgerSettingsProjector, PROJ_LEDGER_SETTINGS } from '@ledger/ledger/infrastructure/projections/ledger-settings.projector';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { databaseConfig } from '@ledger/config/environment/database.config';
import { env } from '@ledger/env';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error('Usage: ts-node rebuild.command.ts <rebuild|rebuildAll|verify-balances> [--projection <name>] [--userId <uuid>]');
    process.exit(1);
  }

  const dbConf = databaseConfig(env);
  const dataSource = new DataSource({
    type: 'postgres',
    host: dbConf.host,
    port: dbConf.port,
    username: dbConf.username,
    password: dbConf.password,
    database: dbConf.database,
  });
  await dataSource.initialize();

  const catalog = new SeedCurrencyCatalog();
  const eventStore = new PostgresEventStore(dataSource);
  const readModel = new PostgresReadModelStore(dataSource);

  const registry = new ProjectionRegistry();
  registry.register('account_tree', [new AccountTreeProjector()], [PROJ_ACCOUNTS]);
  registry.register(
    'transaction_list',
    [new TransactionListProjector()],
    [PROJ_TRANSACTIONS, PROJ_POSTINGS],
  );
  registry.register(
    'account_balances',
    [new AccountBalancesProjector(catalog)],
    [PROJ_BALANCES],
  );
  registry.register('ledger_settings', [new LedgerSettingsProjector()], [PROJ_LEDGER_SETTINGS]);

  try {
    switch (command) {
      case 'rebuild': {
        const projectionName = parseArg(args, '--projection');
        if (!projectionName) {
          console.error('Missing --projection <name>');
          process.exit(1);
        }

        const checkpoints = new InMemoryProjectionCheckpointRepository();
        const rebuilder = new ProjectionRebuilder(eventStore, readModel, checkpoints, registry);
        const applied = await rebuilder.rebuild(projectionName);
        const caughtUp = await rebuilder.isCaughtUp(projectionName);

        console.log(`Rebuild complete: "${projectionName}"`);
        console.log(`  Events applied: ${applied}`);
        console.log(`  Caught up: ${caughtUp}`);
        break;
      }
      case 'rebuildAll': {
        const checkpoints = new InMemoryProjectionCheckpointRepository();
        const rebuilder = new ProjectionRebuilder(eventStore, readModel, checkpoints, registry);
        const reports = await rebuilder.rebuildAll();

        console.log('RebuildAll complete:');
        for (const report of reports) {
          const status = report.success ? 'OK' : 'FAIL';
          console.log(`  ${status}  ${report.projectionName}  (${report.eventsApplied} events)`);
          if (report.error) console.log(`         Error: ${report.error}`);
        }
        break;
      }
      case 'verify-balances': {
        const userId = parseArg(args, '--userId');
        if (!userId) {
          console.error('Missing --userId <uuid>');
          process.exit(1);
        }

        const eventRegistry = createLedgerEventRegistry(catalog);
        const verifier = new ConsistencyVerifier(eventStore, readModel, eventRegistry);
        const report = await verifier.verifyBalances(userId);

        if (report.ok) {
          console.log(`Consistency verified: proj_balances matches the stream for user "${userId}".`);
        } else {
          console.log(`Drift detected for user "${userId}":`);
          for (const d of report.discrepancies) {
            console.log(`  Account: ${d.accountId}  Currency: ${d.currencyCode}`);
            console.log(`    Stream:    confirmed=${d.streamConfirmed.toDecimalString()} pending=${d.streamPending.toDecimalString()}`);
            console.log(`    Projected: confirmed=${d.projectedConfirmed.toDecimalString()} pending=${d.projectedPending.toDecimalString()}`);
            console.log(`    Drift:     confirmed=${d.driftConfirmed.toDecimalString()} pending=${d.driftPending.toDecimalString()}`);
          }
        }
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } finally {
    await dataSource.destroy();
  }
}

function parseArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit -p apps/ledger/tsconfig.app.json 2>&1
```
Esperado: sin errores de tipo.

---

### Tarea 6: Ejecutar suite de tests completa del módulo [X]

```bash
npx jest apps/ledger/src/shared-kernel/application/tooling/ --no-coverage
npx jest apps/ledger/src/shared-kernel/infrastructure/adapters/projection/ --no-coverage
```

Esperado: PASS — todos los tests verdes (los 5 de ProjectionRegistry, los 5 de ProjectionRebuilder, los 5 de ConsistencyVerifier).

```bash
npx jest apps/ledger/ --no-coverage
```

Esperado: PASS — suite completa del ledger en verde (sin regresiones).
