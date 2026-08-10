import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import {
  BalanceRow,
  PROJ_BALANCES,
} from '@ledger/transactions/infrastructure/projections/account-balances.schema';
import { ReadModelAccountBalanceFinder } from './read-model-account-balance-finder';

const NO_FILTER = { accountId: null, currency: null };

type Seed = {
  readonly accountId: string;
  readonly userId?: string;
  readonly currency?: string;
  readonly confirmed?: string;
};

async function storeWith(seeds: readonly Seed[]): Promise<InMemoryReadModelStore> {
  const store = new InMemoryReadModelStore();

  for (const seed of seeds) {
    const row: BalanceRow = {
      user_id: seed.userId ?? 'user-1',
      account_id: seed.accountId,
      currency_code: seed.currency ?? 'COP',
      confirmed_amount: seed.confirmed ?? '1000',
      pending_amount: '0',
    };

    await store.upsert(
      PROJ_BALANCES,
      { user_id: row.user_id, account_id: row.account_id, currency_code: row.currency_code },
      row,
    );
  }

  return store;
}

describe('ReadModelAccountBalanceFinder', () => {
  /**
   * The point of the whole port. The previous handler asked for the entire
   * `proj_balances` table and narrowed it with a `.filter()` in memory, because
   * the row carried no owner and the join it needed was not expressible. The
   * result was right and the mechanism was wrong: the per-user scope has to be
   * in the query (INV-9, rules Art. 5).
   */
  it('never reads another user rows', async () => {
    const store = await storeWith([
      { accountId: 'mine' },
      { accountId: 'theirs', userId: 'user-2' },
    ]);
    const query = jest.spyOn(store, 'query');
    const finder = new ReadModelAccountBalanceFinder(store);

    const balances = await finder.byUser('user-1', NO_FILTER);

    expect(balances.map((balance) => balance.accountId)).toEqual(['mine']);
    // …and the scope reached the store, rather than being applied to its answer.
    expect(query.mock.calls[0][1].filters).toContainEqual(
      expect.objectContaining({ field: 'user_id', value: 'user-1' }),
    );
  });

  it('does not consult the account tree to establish ownership', async () => {
    const store = await storeWith([{ accountId: 'mine' }]);
    const query = jest.spyOn(store, 'query');
    const finder = new ReadModelAccountBalanceFinder(store);

    await finder.byUser('user-1', NO_FILTER);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toBe(PROJ_BALANCES);
  });

  it('narrows by account when the filter states one', async () => {
    const store = await storeWith([{ accountId: 'acc-1' }, { accountId: 'acc-2' }]);
    const finder = new ReadModelAccountBalanceFinder(store);

    const balances = await finder.byUser('user-1', { accountId: 'acc-2', currency: null });

    expect(balances.map((balance) => balance.accountId)).toEqual(['acc-2']);
  });

  it('narrows by currency when the filter states one', async () => {
    const store = await storeWith([
      { accountId: 'acc-1', currency: 'COP' },
      { accountId: 'acc-1', currency: 'USD' },
    ]);
    const finder = new ReadModelAccountBalanceFinder(store);

    const balances = await finder.byUser('user-1', { accountId: null, currency: 'USD' });

    expect(balances.map((balance) => balance.currency)).toEqual(['USD']);
  });

  it('maps a stored row to the wire shape, amounts as exact decimal strings', async () => {
    const store = await storeWith([{ accountId: 'acc-1', confirmed: '-5000' }]);
    const finder = new ReadModelAccountBalanceFinder(store);

    const [balance] = await finder.byUser('user-1', NO_FILTER);

    expect(balance).toEqual({
      accountId: 'acc-1',
      currency: 'COP',
      confirmed: '-5000',
      pending: '0',
    });
  });
});
