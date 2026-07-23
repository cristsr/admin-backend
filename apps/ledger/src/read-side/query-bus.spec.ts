import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { FixedClock, SequentialIdGenerator } from '@ledger/shared/testing';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { QueryBus } from '@ledger/shared-kernel/application/query-bus/query-bus';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
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
});
