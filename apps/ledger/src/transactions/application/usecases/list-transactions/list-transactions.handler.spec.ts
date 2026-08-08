import { QueryContext } from '@cqrs/application/query-bus/query-handler';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { ReadModelTransactionFinder } from '@ledger/transactions/infrastructure/adapters/persistence/read-model-transaction-finder';
import { PROJ_POSTINGS, PROJ_TRANSACTIONS } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';
import { ListTransactionsHandler } from './list-transactions.handler';
import { DEFAULT_TRANSACTION_PAGE_SIZE, ListTransactionsQuery } from './list-transactions.query';

const ctx: QueryContext = { userId: 'user-1' };

const txRow = (transactionId: string, date: string) => ({
  transaction_id: transactionId,
  user_id: 'user-1',
  date,
  occurred_at: null,
  payee: 'Bakery',
  description: 'Bread',
  status: 'CONFIRMED',
  derived_kind: 'EXPENSE',
  invoice_url: null,
  tags: [],
  client_id: 'client-1',
  external_ref: null,
  reverses_id: null,
  metadata: {},
});

/**
 * The real twin over an in-memory store, not a fake: a hand-written double
 * would be free to filter differently than the adapter does. The
 * adapter-level behaviour itself is pinned by the shared contract
 * (`transaction-finder.contract.ts`); here the handler only delegates.
 */
async function handlerWith(
  rows: { transactions: readonly object[]; postings: readonly object[] },
): Promise<ListTransactionsHandler> {
  const store = new InMemoryReadModelStore();

  for (const row of rows.transactions) {
    await store.upsert(
      PROJ_TRANSACTIONS,
      { transaction_id: (row as { transaction_id: string }).transaction_id },
      row as Record<string, unknown>,
    );
  }
  for (const row of rows.postings) {
    await store.upsert(
      PROJ_POSTINGS,
      { posting_id: (row as { posting_id: string }).posting_id },
      row as Record<string, unknown>,
    );
  }

  return new ListTransactionsHandler(new ReadModelTransactionFinder(store));
}

describe('ListTransactionsHandler', () => {
  it('narrows by account before paginating, so matches beyond the first page survive', async () => {
    const handler = await handlerWith({
      transactions: [txRow('tx-1', '2026-07-20'), txRow('tx-2', '2026-07-21')],
      postings: [
        { posting_id: 'p-1', transaction_id: 'tx-1', user_id: 'user-1', account_id: 'acc-a' },
        { posting_id: 'p-2', transaction_id: 'tx-2', user_id: 'user-1', account_id: 'acc-a' },
      ],
    });

    const page = await handler.execute(new ListTransactionsQuery('acc-a', null, null, null, null, null, null, 1, 0), ctx);

    // One of two matches, not one of every account: the account filter ran
    // before pagination.
    expect(page.items.map((item) => item.id)).toEqual(['tx-2']);
    expect(page.total).toBe(2);
  });

  it('returns nothing when the account has no postings, instead of every transaction', async () => {
    const handler = await handlerWith({
      transactions: [txRow('tx-1', '2026-07-20'), txRow('tx-2', '2026-07-21')],
      postings: [],
    });

    const page = await handler.execute(new ListTransactionsQuery('acc-unused'), ctx);

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('bounds an unpaginated read with the default page size', async () => {
    const handler = await handlerWith({ transactions: [], postings: [] });

    const page = await handler.execute(new ListTransactionsQuery(), ctx);

    expect(page.limit).toBe(DEFAULT_TRANSACTION_PAGE_SIZE);
    expect(page.offset).toBe(0);
  });

  it('forwards the caller, so every read is scoped (INV-9)', async () => {
    const handler = await handlerWith({
      transactions: [txRow('tx-1', '2026-07-20')],
      postings: [],
    });

    const page = await handler.execute(new ListTransactionsQuery(), { ...ctx, userId: 'user-2' });

    expect(page.items).toEqual([]);
  });
});
