import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { QueryContext } from '@cqrs/application/query-bus/query-handler';
import { Criteria, FilterOperator } from '@shared';
import {
  PROJ_POSTINGS,
  PROJ_TRANSACTIONS,
} from '@ledger/transactions/application/read-models/transaction-list.read-model';
import { ListTransactionsHandler } from './list-transactions.handler';
import { DEFAULT_TRANSACTION_PAGE_SIZE, ListTransactionsQuery } from './list-transactions.query';

const ctx: QueryContext = { userId: 'user-1' };

/**
 * Records the criteria each table was queried with, so ordering is observable.
 * `query` and `count` are tracked apart: they are asked the same filters but
 * only one of them may carry pagination.
 */
class RecordingReadModelStore {
  readonly calls: { table: string; criteria: Criteria }[] = [];
  readonly counts: { table: string; criteria: Criteria }[] = [];

  constructor(private readonly rowsByTable: Record<string, unknown[]> = {}) {}

  query = jest.fn(async (table: string, criteria: Criteria): Promise<unknown[]> => {
    this.calls.push({ table, criteria });
    return this.rowsByTable[table] ?? [];
  });

  count = jest.fn(async (table: string, criteria: Criteria): Promise<number> => {
    this.counts.push({ table, criteria });
    return (this.rowsByTable[table] ?? []).length;
  });

  criteriaFor(table: string): Criteria {
    const call = this.calls.find((entry) => entry.table === table);
    if (!call) throw new Error(`"${table}" was never queried`);
    return call.criteria;
  }

  countCriteriaFor(table: string): Criteria {
    const call = this.counts.find((entry) => entry.table === table);
    if (!call) throw new Error(`"${table}" was never counted`);
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

    const page = await handlerWith(store).execute(new ListTransactionsQuery('acc-unused'), ctx);

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    expect(store.calls.map((call) => call.table)).not.toContain(PROJ_TRANSACTIONS);
  });

  it('bounds an unpaginated read with the default page size', async () => {
    const store = new RecordingReadModelStore();

    const page = await handlerWith(store).execute(new ListTransactionsQuery(), ctx);

    expect(store.criteriaFor(PROJ_TRANSACTIONS).pagination).toEqual({
      take: DEFAULT_TRANSACTION_PAGE_SIZE,
      skip: 0,
    });
    expect(page.limit).toBe(DEFAULT_TRANSACTION_PAGE_SIZE);
    expect(page.offset).toBe(0);
  });

  /**
   * A total drawn from the paginated criteria would just be the page size, and
   * the caller could never tell there was a second page.
   */
  it('counts the filters without the pagination', async () => {
    const store = new RecordingReadModelStore();

    await handlerWith(store).execute(
      new ListTransactionsQuery(null, null, null, null, null, null, null, 1, 0),
      ctx,
    );

    expect(store.countCriteriaFor(PROJ_TRANSACTIONS).isPaginated).toBe(false);
    expect(store.criteriaFor(PROJ_TRANSACTIONS).pagination).toEqual({ take: 1, skip: 0 });
  });

  it('counts the same filters the page was drawn with', async () => {
    const store = new RecordingReadModelStore();

    await handlerWith(store).execute(new ListTransactionsQuery(null, 'CONFIRMED'), ctx);

    expect(store.countCriteriaFor(PROJ_TRANSACTIONS).filters).toContainEqual(
      expect.objectContaining({ field: 'status', value: 'CONFIRMED' }),
    );
  });

  it('scopes every read to the caller (INV-9)', async () => {
    const store = new RecordingReadModelStore();

    await handlerWith(store).execute(new ListTransactionsQuery(), ctx);

    expect(store.criteriaFor(PROJ_TRANSACTIONS).filters).toContainEqual(
      expect.objectContaining({ field: 'user_id', value: 'user-1' }),
    );
  });
});
