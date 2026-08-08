import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { ReadModelAccountNameReader } from './read-model-account-name-reader';

async function storeWith(
  names: readonly { name: string; userId?: string }[],
): Promise<InMemoryReadModelStore> {
  const store = new InMemoryReadModelStore();

  for (const [index, entry] of names.entries()) {
    const row: AccountRow = {
      account_id: `acc-${index}`,
      user_id: entry.userId ?? 'user-1',
      type: 'ASSETS',
      name: entry.name,
      parent_id: null,
      currency_code: 'COP',
      opened_on: '2026-01-01',
      closed_on: null,
      is_bank_mirror: false,
      is_system: false,
    };

    await store.upsert(PROJ_ACCOUNTS, { account_id: row.account_id }, row);
  }

  return store;
}

describe('ReadModelAccountNameReader', () => {
  describe('isTaken', () => {
    it('answers false for a name nobody holds', async () => {
      const reader = new ReadModelAccountNameReader(await storeWith([{ name: 'Assets:Bank' }]));

      await expect(reader.isTaken('user-1', 'Assets:Cash')).resolves.toBe(false);
    });

    it('answers true for a name already held', async () => {
      const reader = new ReadModelAccountNameReader(await storeWith([{ name: 'Assets:Bank' }]));

      await expect(reader.isTaken('user-1', 'Assets:Bank')).resolves.toBe(true);
    });

    it('scopes the check to the user, so the same name is free for everyone else (INV-9)', async () => {
      const reader = new ReadModelAccountNameReader(
        await storeWith([{ name: 'Assets:Bank', userId: 'user-2' }]),
      );

      await expect(reader.isTaken('user-1', 'Assets:Bank')).resolves.toBe(false);
    });

    it('asks the store for the name rather than sweeping the chart of accounts', async () => {
      const store = await storeWith([{ name: 'Assets:Bank' }, { name: 'Assets:Cash' }]);
      const query = jest.spyOn(store, 'query');
      const reader = new ReadModelAccountNameReader(store);

      await reader.isTaken('user-1', 'Assets:Bank');

      expect(query.mock.calls[0][1].filters).toContainEqual(
        expect.objectContaining({ field: 'name', value: 'Assets:Bank' }),
      );
    });
  });

  describe('namesOf', () => {
    it('lists every name the user holds, for the rename check', async () => {
      const reader = new ReadModelAccountNameReader(
        await storeWith([{ name: 'Assets:Bank' }, { name: 'Assets:Bank:Savings' }]),
      );

      const names = await reader.namesOf('user-1');

      expect([...names].sort()).toEqual(['Assets:Bank', 'Assets:Bank:Savings']);
    });

    it('leaves out the names of other users (INV-9)', async () => {
      const reader = new ReadModelAccountNameReader(
        await storeWith([{ name: 'Mine' }, { name: 'Theirs', userId: 'user-2' }]),
      );

      await expect(reader.namesOf('user-1')).resolves.toEqual(['Mine']);
    });
  });
});
