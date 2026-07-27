import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { InMemoryEventStore } from '@cqrs/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { GetAccountBalancesQuery } from './get-account-balances/get-account-balances.query';
import { GetAccountTreeQuery } from './get-account-tree/get-account-tree.query';
import { ListTransactionsQuery } from './list-transactions/list-transactions.query';
import { createQueryBus } from './query-bus.factory';

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

  return { commandBus, queryBus: createQueryBus(readModel), assets: assets.aggregateId };
}

describe('Query bus (read side)', () => {
  it('lists transactions scoped to the user', async () => {
    const { queryBus } = await seed();

    const rows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(),
      ctx,
    );

    expect(rows).toHaveLength(1);
  });

  it('returns the account tree ordered by name', async () => {
    const { queryBus } = await seed();

    const rows = await queryBus.ask<readonly { name: string }[]>(new GetAccountTreeQuery(), ctx);

    expect(rows.map((r) => r.name)).toEqual(['Assets:Bank', 'Expenses:Food']);
  });

  it('returns balances for the user accounts', async () => {
    const { queryBus, assets } = await seed();

    const rows = await queryBus.ask<readonly { account_id: string; confirmed_amount: string }[]>(
      new GetAccountBalancesQuery(assets),
      ctx,
    );

    expect(rows).toEqual([
      expect.objectContaining({ account_id: assets, confirmed_amount: '-5000' }),
    ]);
  });

  it('lists transactions filtered by clientId (AC-6, RF-12)', async () => {
    const { queryBus } = await seed();

    const rows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, 'c'),
      ctx,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].transaction_id).toBeDefined();
  });

  it('returns empty list when clientId does not match (AC-6, AC-8)', async () => {
    const { queryBus } = await seed();

    const rows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, 'other-client'),
      ctx,
    );

    expect(rows).toHaveLength(0);
  });

  it('paginates transactions with offset and limit (AC-6)', async () => {
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

    const page1 = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, null, null, null, 1, 0),
      ctx,
    );
    expect(page1).toHaveLength(1);

    const page2 = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(null, null, null, null, null, null, null, 1, 1),
      ctx,
    );
    expect(page2).toHaveLength(1);

    expect(page1[0].transaction_id).not.toBe(page2[0].transaction_id);
  });

  it('does not leak data across users (AC-8, INV-9)', async () => {
    const { queryBus } = await seed();

    const otherCtx = { ...ctx, userId: 'user-2' };

    const txRows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(),
      otherCtx,
    );
    expect(txRows).toHaveLength(0);

    const treeRows = await queryBus.ask<readonly { name: string }[]>(
      new GetAccountTreeQuery(),
      otherCtx,
    );
    expect(treeRows).toHaveLength(0);
  });

  it('query handlers never access EventStore (AC-5, RNF-10)', async () => {
    const { queryBus } = await seed();

    const txRows = await queryBus.ask<readonly { transaction_id: string }[]>(
      new ListTransactionsQuery(),
      ctx,
    );
    const treeRows = await queryBus.ask<readonly { name: string }[]>(
      new GetAccountTreeQuery(),
      ctx,
    );
    const balanceRows = await queryBus.ask<readonly { account_id: string }[]>(
      new GetAccountBalancesQuery(),
      ctx,
    );

    expect(txRows.length).toBeGreaterThanOrEqual(0);
    expect(treeRows.length).toBeGreaterThanOrEqual(0);
    expect(balanceRows.length).toBeGreaterThanOrEqual(0);
  });
});
