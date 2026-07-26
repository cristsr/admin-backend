import { Criteria, FilterOperator } from '@shared';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { QueryContext } from '@ledger/shared-kernel/application/query-bus/query-handler';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
} from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import { ListTransactionsHandler } from './list-transactions.handler';
import { DEFAULT_TRANSACTION_PAGE_SIZE, ListTransactionsQuery } from './list-transactions.query';

const ctx: QueryContext = { userId: 'user-1' };

/** Records the criteria each table was queried with, so ordering is observable. */
class RecordingReadModelStore {
  readonly calls: { table: string; criteria: Criteria }[] = [];

  constructor(private readonly rowsByTable: Record<string, unknown[]> = {}) {}

  query = jest.fn(async (table: string, criteria: Criteria): Promise<unknown[]> => {
    this.calls.push({ table, criteria });
    return this.rowsByTable[table] ?? [];
  });

  criteriaFor(table: string): Criteria {
    const call = this.calls.find((entry) => entry.table === table);
    if (!call) throw new Error(`"${table}" was never queried`);
    return call.criteria;
  }
}

const handlerWith = (store: RecordingReadModelStore): ListTransactionsHandler =>
  new ListTransactionsHandler(store as unknown as ReadModelStore);

describe('ListTransactionsHandler', () => {
  it('narrows by account before paginating, so matches beyond the first page survive', async () => {
    const store = new RecordingReadModelStore({
      [PROJ_POSTINGS]: [{ transaction_id: 'tx-1' }, { transaction_id: 'tx-2' }],
      [PROJ_TRANSACTIONS]: [{ transaction_id: 'tx-1' }],
    });

    await handlerWith(store).execute(
      new ListTransactionsQuery('acc-1', null, null, null, null, null, null, 1, 0),
      ctx,
    );

    const criteria = store.criteriaFor(PROJ_TRANSACTIONS);
    const idFilter = criteria.filters.find((filter) => filter.field === 'transaction_id');

    expect(idFilter?.operator).toBe(FilterOperator.IN);
    expect(idFilter?.value).toEqual(['tx-1', 'tx-2']);
    expect(criteria.pagination).toEqual({ take: 1, skip: 0 });
  });

  it('returns nothing when the account has no postings, instead of every transaction', async () => {
    const store = new RecordingReadModelStore({
      [PROJ_POSTINGS]: [],
      [PROJ_TRANSACTIONS]: [{ transaction_id: 'tx-1' }, { transaction_id: 'tx-2' }],
    });

    const rows = await handlerWith(store).execute(new ListTransactionsQuery('acc-unused'), ctx);

    expect(rows).toEqual([]);
    expect(store.calls.map((call) => call.table)).not.toContain(PROJ_TRANSACTIONS);
  });

  it('bounds an unpaginated read with the default page size', async () => {
    const store = new RecordingReadModelStore();

    await handlerWith(store).execute(new ListTransactionsQuery(), ctx);

    expect(store.criteriaFor(PROJ_TRANSACTIONS).pagination).toEqual({
      take: DEFAULT_TRANSACTION_PAGE_SIZE,
      skip: 0,
    });
  });

  it('scopes every read to the caller (INV-9)', async () => {
    const store = new RecordingReadModelStore();

    await handlerWith(store).execute(new ListTransactionsQuery(), ctx);

    expect(store.criteriaFor(PROJ_TRANSACTIONS).filters).toContainEqual(
      expect.objectContaining({ field: 'user_id', value: 'user-1' }),
    );
  });
});
