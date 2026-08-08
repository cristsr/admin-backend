import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Nullable } from '@shared';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { ReadModelAccountFactsReader } from './read-model-account-facts-reader';

type Seed = {
  readonly accountId: string;
  readonly userId?: string;
  readonly type?: string;
  readonly currencyCode?: Nullable<string>;
  readonly isBankMirror?: boolean;
};

async function storeWith(seeds: readonly Seed[]): Promise<InMemoryReadModelStore> {
  const store = new InMemoryReadModelStore();

  for (const seed of seeds) {
    const row: AccountRow = {
      account_id: seed.accountId,
      user_id: seed.userId ?? 'user-1',
      type: seed.type ?? 'ASSETS',
      name: `Assets:${seed.accountId}`,
      parent_id: null,
      // `??` would turn an explicit null — "accepts any currency" — back into COP.
      currency_code: 'currencyCode' in seed ? (seed.currencyCode as Nullable<string>) : 'COP',
      opened_on: '2026-01-01',
      closed_on: null,
      is_bank_mirror: seed.isBankMirror ?? false,
      is_system: false,
    };

    await store.upsert(PROJ_ACCOUNTS, { account_id: seed.accountId }, row);
  }

  return store;
}

describe('ReadModelAccountFactsReader', () => {
  it('maps the stored row to the facts its consumers need', async () => {
    const store = await storeWith([
      { accountId: 'acc-1', type: 'ASSETS', currencyCode: 'COP', isBankMirror: true },
    ]);

    const facts = await new ReadModelAccountFactsReader(store).factsOf('user-1', 'acc-1');

    expect(facts).toEqual({
      accountId: 'acc-1',
      type: 'ASSETS',
      currency: 'COP',
      isBankMirror: true,
    });
  });

  /** An account with no currency takes any; the column is null, not absent. */
  it('reports a null currency as null rather than dropping it', async () => {
    const store = await storeWith([{ accountId: 'acc-1', currencyCode: null }]);

    const facts = await new ReadModelAccountFactsReader(store).factsOf('user-1', 'acc-1');

    expect(facts?.currency).toBeNull();
  });

  /**
   * INV-9 / rules Art. 5: the scope is a `WHERE`, not a filter afterwards. An
   * account belonging to someone else is simply unknown here.
   */
  it('never answers with another user account', async () => {
    const store = await storeWith([{ accountId: 'acc-1', userId: 'user-2' }]);

    const facts = await new ReadModelAccountFactsReader(store).factsOf('user-1', 'acc-1');

    expect(facts).toBeNull();
  });

  it('returns null for an account that does not exist', async () => {
    const store = await storeWith([]);

    const facts = await new ReadModelAccountFactsReader(store).factsOf('user-1', 'missing');

    expect(facts).toBeNull();
  });
});
