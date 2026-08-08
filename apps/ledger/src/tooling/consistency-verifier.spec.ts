import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionRegistry } from '@cqrs/application/tooling/projection-registry';
import { InMemoryEventStore } from '@cqrs/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PROJ_ACCOUNTS } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { OpenAccountCommand } from '@ledger/accounts/application/usecases/open-account/open-account.command';
import { AccountTreeProjector } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { createLedgerApplication } from '@ledger/bootstrap/ledger-application.factory';
import { RegisterCurrencyCommand } from '@ledger/reference/application/usecases/register-currency/register-currency.command';
import { ReadModelCurrencyCatalog } from '@ledger/reference/infrastructure/adapters/read-model-currency-catalog';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { PROJ_BALANCES } from '@ledger/transactions/application/read-models/account-balances.read-model';
import { PROJ_POSTINGS, PROJ_TRANSACTIONS } from '@ledger/transactions/application/read-models/transaction-list.read-model';
import { RecordTransactionCommand } from '@ledger/transactions/application/usecases/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { AccountBalancesProjector } from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import { TransactionListProjector } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
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
  it('returns OK for an empty stream', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    const verifier = new ConsistencyVerifier(eventStore, readModel, new SeedCurrencyCatalog());

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it('returns OK when stream-derived balances match proj_balances', async () => {
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

    const verifier = new ConsistencyVerifier(eventStore, liveReadModel, catalog);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it('detects drift when a proj_balances row is corrupted', async () => {
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

    const verifier = new ConsistencyVerifier(eventStore, readModel, catalog);

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

    const verifier = new ConsistencyVerifier(eventStore, readModel, catalog);

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

    const verifier = new ConsistencyVerifier(eventStore, readModel, catalog);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.ok).toBe(false);
    expect(report.discrepancies).toHaveLength(1);
    expect(report.discrepancies[0].accountId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('replays a stream that spans several pages without skipping the boundary', async () => {
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

    for (let i = 0; i < 8; i += 1) {
      await app.commandBus.dispatch(
        new RecordTransactionCommand(
          '2026-07-20',
          'Bakery',
          `Bread ${i}`,
          [
            { accountId: expenses.aggregateId, amount: '1000', currency: 'COP' },
            { accountId: assets.aggregateId, amount: '-1000', currency: 'COP' },
          ],
          TransactionStatus.CONFIRMED,
        ),
        { ...ctx, externalRef: `ref-${i}` },
      );
    }

    // A page size far below the event count forces several `readAll` round
    // trips, so an off-by-one cursor drops the event on each boundary.
    const verifier = new ConsistencyVerifier(eventStore, readModel, catalog, 2);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.discrepancies).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('ignores the balances of other users', async () => {
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

    // user-2 owns a non-zero balance. Verifying user-1 must not read it as
    // drift: `proj_balances` carries no user id, so ownership comes from the
    // account tree.
    const theirExpenses = await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      otherCtx,
    );
    const theirAssets = await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
      otherCtx,
    );
    await app.commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Bakery',
        'Bread',
        [
          { accountId: theirExpenses.aggregateId, amount: '5000', currency: 'COP' },
          { accountId: theirAssets.aggregateId, amount: '-5000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      otherCtx,
    );

    const verifier = new ConsistencyVerifier(eventStore, readModel, catalog);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.discrepancies).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('verifies balances held in a currency registered beyond the base set', async () => {
    const eventStore = new InMemoryEventStore();
    const readModel = new InMemoryReadModelStore();
    // The catalog the CLI hands over in production: whatever `proj_currencies`
    // holds, not a fixed seed. A ledger using CLF must still be verifiable.
    const catalog = new ReadModelCurrencyCatalog(readModel);

    const app = createLedgerApplication({
      eventStore,
      readModel,
      clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
      idGenerator: new SequentialIdGenerator(),
      catalog,
      catalogCache: catalog,
    });

    await app.commandBus.dispatch(new RegisterCurrencyCommand('CLF', 4, 'Unidad de Fomento'), ctx);

    const expenses = await app.commandBus.dispatch(
      new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
      ctx,
    );
    const assets = await app.commandBus.dispatch(
      new OpenAccountCommand('Assets:Bank', ['CLF'], '2026-01-01', false),
      ctx,
    );
    await app.commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-20',
        'Bakery',
        'Bread',
        [
          { accountId: expenses.aggregateId, amount: '5.0000', currency: 'CLF' },
          { accountId: assets.aggregateId, amount: '-5.0000', currency: 'CLF' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      ctx,
    );

    const verifier = new ConsistencyVerifier(eventStore, readModel, catalog);

    const report = await verifier.verifyBalances(ctx.userId);

    expect(report.discrepancies).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
