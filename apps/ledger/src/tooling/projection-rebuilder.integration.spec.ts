import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionRegistry } from '@cqrs/application/tooling/projection-registry';
import { InMemoryEventStore } from '@cqrs/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryProjectionCheckpointRepository } from '@cqrs/infrastructure/adapters/projection/in-memory-projection-checkpoint.repository';
import { ProjectionRebuilder } from '@cqrs/infrastructure/adapters/projection/projection-rebuilder';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { OpenAccountCommand } from '@ledger/accounts/application/usecases/open-account/open-account.command';
import { AccountTreeProjector } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { createLedgerApplication } from '@ledger/bootstrap/ledger-application.factory';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { PROJ_BALANCES } from '@ledger/transactions/infrastructure/projections/account-balances.schema';
import { PROJ_POSTINGS, PROJ_TRANSACTIONS } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';
import { RecordTransactionCommand } from '@ledger/transactions/application/usecases/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';
import { AccountBalancesProjector } from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import { TransactionListProjector } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';

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
  it('reconstructs the whole read model from the event stream', async () => {
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

    const applied = await rebuilder.rebuild('core');
    expect(applied).toBeGreaterThan(0);
    expect(await rebuilder.isCaughtUp('core')).toBe(true);

    const live = await liveReadModel.query(PROJ_BALANCES, Criteria.none());
    const rebuilt = await rebuiltReadModel.query(PROJ_BALANCES, Criteria.none());
    expect(rebuilt).toEqual(live);
  });

  it('rebuilds a single projection without affecting others', async () => {
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

    const accountsBefore = await liveReadModel.query(PROJ_ACCOUNTS, Criteria.none());

    const rebuiltReadModel = new InMemoryReadModelStore();
    const checkpoints = new InMemoryProjectionCheckpointRepository();
    const { registry } = buildRegistry();
    const rebuilder = new ProjectionRebuilder(eventStore, rebuiltReadModel, checkpoints, registry);

    await rebuilder.rebuild('account_balances');

    const accountsRebuilt = await rebuiltReadModel.query(PROJ_ACCOUNTS, Criteria.none());
    expect(accountsRebuilt).toHaveLength(0);

    expect(accountsBefore.length).toBeGreaterThan(0);
  });

  it('rebuildAll reconstructs all registered projections and returns reports', async () => {
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

    for (const report of reports) {
      expect(await rebuilder.isCaughtUp(report.projectionName)).toBe(true);
    }
  });

  it('rebuild is idempotent — running twice produces same state', async () => {
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

    await rebuilder.rebuild('core');
    const firstAccounts = await readModel.query(PROJ_ACCOUNTS, Criteria.none());

    await rebuilder.rebuild('core');
    const secondAccounts = await readModel.query(PROJ_ACCOUNTS, Criteria.none());

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
