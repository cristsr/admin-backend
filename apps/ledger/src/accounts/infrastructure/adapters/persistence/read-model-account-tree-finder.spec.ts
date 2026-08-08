import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Nullable } from '@shared';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { ReadModelAccountTreeFinder } from './read-model-account-tree-finder';

type Seed = {
  readonly accountId: string;
  readonly userId?: string;
  readonly name?: string;
  readonly closedOn?: Nullable<string>;
  readonly currencyCode?: Nullable<string>;
};

async function finderWith(seeds: readonly Seed[]): Promise<ReadModelAccountTreeFinder> {
  const store = new InMemoryReadModelStore();

  for (const seed of seeds) {
    const row: AccountRow = {
      account_id: seed.accountId,
      user_id: seed.userId ?? 'user-1',
      type: 'ASSETS',
      name: seed.name ?? `Assets:${seed.accountId}`,
      parent_id: null,
      currency_code: seed.currencyCode ?? 'COP',
      opened_on: '2026-01-01',
      closed_on: seed.closedOn ?? null,
      is_bank_mirror: false,
      is_system: false,
    };

    await store.upsert(PROJ_ACCOUNTS, { account_id: seed.accountId }, row);
  }

  return new ReadModelAccountTreeFinder(store);
}

describe('ReadModelAccountTreeFinder', () => {
  describe('tree', () => {
    it('returns the accounts of the requesting user, ordered by name', async () => {
      const finder = await finderWith([
        { accountId: 'acc-2', name: 'Assets:Wallet' },
        { accountId: 'acc-1', name: 'Assets:Bank' },
      ]);

      const tree = await finder.tree('user-1');

      expect(tree.map((account) => account.name)).toEqual(['Assets:Bank', 'Assets:Wallet']);
    });

    it('leaves out the accounts of every other user (INV-9)', async () => {
      const finder = await finderWith([
        { accountId: 'mine' },
        { accountId: 'theirs', userId: 'user-2' },
      ]);

      const tree = await finder.tree('user-1');

      expect(tree.map((account) => account.id)).toEqual(['mine']);
    });
  });

  describe('byId', () => {
    it('returns the account as the API exposes it', async () => {
      const finder = await finderWith([{ accountId: 'acc-1', closedOn: '2026-06-30' }]);

      const account = await finder.byId('user-1', 'acc-1');

      expect(account).toMatchObject({ id: 'acc-1', closedOn: '2026-06-30', isClosed: true });
    });

    it('returns null when the account belongs to another user (INV-9)', async () => {
      const finder = await finderWith([{ accountId: 'theirs', userId: 'user-2' }]);

      await expect(finder.byId('user-1', 'theirs')).resolves.toBeNull();
    });

    it('returns null when no account matches', async () => {
      const finder = await finderWith([]);

      await expect(finder.byId('user-1', 'ghost')).resolves.toBeNull();
    });
  });
});
