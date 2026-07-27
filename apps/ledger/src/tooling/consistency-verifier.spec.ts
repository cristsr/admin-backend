import { Criteria } from '@shared';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { AccountTreeProjector, PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { Money } from '@ledger/shared/domain/money';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { ProjectionRegistry } from '@ledger/shared-kernel/application/tooling/projection-registry';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
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
import { ConsistencyVerifier } from './consistency-verifier';

const ctx: AuthContext = { userId: 'user-1', clientId: 'c', externalRef: null };
const otherCtx: AuthContext = { userId: 'user-2', clientId: 'c2', externalRef: null };

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
  it('returns OK for an empty stream (AC-5)', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const catalog = new SeedCurrencyCatalog();
    const eventRegistry = createLedgerEventRegistry(catalog);
    const verifier = new ConsistencyVerifier(eventStore, readModel, eventRegistry);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it('returns OK when stream-derived balances match proj_balances (AC-5)', async () => {
    const eventStore = new InMemoryEventStore();
    const liveReadModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistryAndCatalog();

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

    const report = await verifier.verifyBalances(otherCtx.userId);

    expect(report.ok).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it('detects extra row in proj_balances not in stream', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const { catalog } = buildRegistryAndCatalog();

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
