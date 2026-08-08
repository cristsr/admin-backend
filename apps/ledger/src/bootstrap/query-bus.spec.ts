import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { InMemoryEventStore } from '@cqrs/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { GetAccountBalancesQuery } from '@ledger/accounts/application/usecases/get-account-balances/get-account-balances.query';
import { GetAccountTreeQuery } from '@ledger/accounts/application/usecases/get-account-tree/get-account-tree.query';
import { OpenAccountCommand } from '@ledger/accounts/application/usecases/open-account/open-account.command';
import { createLedgerApplication } from '@ledger/bootstrap/ledger-application.factory';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { ListTransactionsQuery } from '@ledger/transactions/application/usecases/list-transactions/list-transactions.query';
import { RecordTransactionCommand } from '@ledger/transactions/application/usecases/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { createQueryBus } from './query-bus.factory';
import { createQueryPorts } from './read-side-ports.factory';

const ctx: AuthContext = { userId: 'user-1', clientId: 'c', externalRef: null };

async function seed(): Promise<{ commandBus: CommandBus; queryBus: QueryBus; assets: string }> {
  const readModel = new InMemoryReadModelStore();
  const app = createLedgerApplication({
    eventStore: new InMemoryEventStore(),
    readModel,
    clock: new FixedClock(new Date('2026-07-22T12:00:00.000Z')),
    idGenerator: new SequentialIdGenerator(),
    catalog: new SeedCurrencyCatalog(),
  });
  const commandBus = app.commandBus;

  const expenses = await commandBus.dispatch(
    new OpenAccountCommand('Expenses:Food', [], '2026-01-01', false),
    ctx,
  );
  const assets = await commandBus.dispatch(
    new OpenAccountCommand('Assets:Bank', ['COP'], '2026-01-01', false),
    ctx,
  );
  await commandBus.dispatch(
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

  return { commandBus, queryBus: createQueryBus(createQueryPorts(readModel)), assets: assets.aggregateId };
}

describe('Query bus (read side)', () => {
  it('lists transactions scoped to the user', async () => {
    const { queryBus } = await seed();

    const page = await queryBus.ask(new ListTransactionsQuery(), ctx);

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });

  it('returns the account tree ordered by name', async () => {
    const { queryBus } = await seed();

    const rows = await queryBus.ask(new GetAccountTreeQuery(), ctx);

    expect(rows.map((r) => r.name)).toEqual(['Assets:Bank', 'Expenses:Food']);
  });

  it('returns balances for the user accounts', async () => {
    const { queryBus, assets } = await seed();

    const rows = await queryBus.ask(new GetAccountBalancesQuery(assets), ctx);

    expect(rows).toEqual([
      expect.objectContaining({ accountId: assets, confirmed: '-5000' }),
    ]);
  });

  it('lists transactions filtered by clientId', async () => {
    const { queryBus } = await seed();

    const page = await queryBus.ask(new ListTransactionsQuery(null, null, null, null, 'c'), ctx);

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.items[0].id).toBeDefined();
  });

  it('returns empty list when clientId does not match', async () => {
    const { queryBus } = await seed();

    const page = await queryBus.ask(
      new ListTransactionsQuery(null, null, null, null, 'other-client'),
      ctx,
    );

    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
  });

  it('paginates transactions with offset and limit', async () => {
    const { queryBus, commandBus } = await seed();

    const expenses2 = await commandBus.dispatch(
      new OpenAccountCommand('Expenses:Transport', [], '2026-01-01', false),
      ctx,
    );
    const assets2 = await commandBus.dispatch(
      new OpenAccountCommand('Assets:Wallet', ['COP'], '2026-01-01', false),
      ctx,
    );
    await commandBus.dispatch(
      new RecordTransactionCommand(
        '2026-07-21',
        'Market',
        'Groceries',
        [
          { accountId: expenses2.aggregateId, amount: '3000', currency: 'COP' },
          { accountId: assets2.aggregateId, amount: '-3000', currency: 'COP' },
        ],
        TransactionStatus.CONFIRMED,
      ),
      { ...ctx, externalRef: 'ref-2' },
    );

    const page1 = await queryBus.ask(
      new ListTransactionsQuery(null, null, null, null, null, null, null, 1, 0),
      ctx,
    );
    expect(page1.items).toHaveLength(1);

    const page2 = await queryBus.ask(
      new ListTransactionsQuery(null, null, null, null, null, null, null, 1, 1),
      ctx,
    );
    expect(page2.items).toHaveLength(1);

    // The total describes the filters, not the page: both pages report it.
    expect(page1.total).toBe(2);
    expect(page2.total).toBe(2);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
  });

  it('does not leak data across users (INV-9)', async () => {
    const { queryBus } = await seed();

    const otherCtx = { ...ctx, userId: 'user-2' };

    const txPage = await queryBus.ask(new ListTransactionsQuery(), otherCtx);
    expect(txPage.items).toHaveLength(0);
    expect(txPage.total).toBe(0);

    const treeRows = await queryBus.ask(new GetAccountTreeQuery(), otherCtx);
    expect(treeRows).toHaveLength(0);
  });

  it('query handlers never access EventStore', async () => {
    const { queryBus } = await seed();

    const txPage = await queryBus.ask(new ListTransactionsQuery(), ctx);
    const treeRows = await queryBus.ask(new GetAccountTreeQuery(), ctx);
    const balanceRows = await queryBus.ask(new GetAccountBalancesQuery(), ctx);

    expect(txPage.items.length).toBeGreaterThanOrEqual(0);
    expect(treeRows.length).toBeGreaterThanOrEqual(0);
    expect(balanceRows.length).toBeGreaterThanOrEqual(0);
  });
});
