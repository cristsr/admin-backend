import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { FilterOperator, Nullable } from '@shared';
import {
  AccountRow,
  PROJ_ACCOUNTS,
} from '@ledger/accounts/infrastructure/projections/account-tree.schema';
import { ReadModelAccountConstraintsReader } from './read-model-account-constraints-reader';

type Seed = {
  readonly accountId: string;
  readonly userId?: string;
  readonly currencyCode?: Nullable<string>;
  readonly closedOn?: Nullable<string>;
  readonly isSystem?: boolean;
};

async function storeWith(seeds: readonly Seed[]): Promise<InMemoryReadModelStore> {
  const store = new InMemoryReadModelStore();

  for (const seed of seeds) {
    const row: AccountRow = {
      account_id: seed.accountId,
      user_id: seed.userId ?? 'user-1',
      type: 'ASSETS',
      name: `Assets:${seed.accountId}`,
      parent_id: null,
      // `??` would turn an explicit null — "accepts any currency" — back into COP.
      currency_code: 'currencyCode' in seed ? (seed.currencyCode as Nullable<string>) : 'COP',
      opened_on: '2026-01-01',
      closed_on: seed.closedOn ?? null,
      is_bank_mirror: false,
      is_system: seed.isSystem ?? false,
    };

    await store.upsert(PROJ_ACCOUNTS, { account_id: seed.accountId }, row);
  }

  return store;
}

describe('ReadModelAccountConstraintsReader', () => {
  it('asks only for the accounts the postings reference', async () => {
    const store = await storeWith([
      { accountId: 'acc-1' },
      { accountId: 'acc-2' },
      { accountId: 'acc-3' },
    ]);
    const query = jest.spyOn(store, 'query');
    const reader = new ReadModelAccountConstraintsReader(store);

    await reader.byIds('user-1', ['acc-1', 'acc-2']);

    // Validating two postings used to sweep the user's whole chart of accounts.
    expect(query.mock.calls[0][1].filters).toContainEqual(
      expect.objectContaining({ field: 'account_id', operator: FilterOperator.IN }),
    );
  });

  it('keys the result by account id', async () => {
    const store = await storeWith([{ accountId: 'acc-1' }, { accountId: 'acc-2' }]);
    const reader = new ReadModelAccountConstraintsReader(store);

    const constraints = await reader.byIds('user-1', ['acc-1', 'acc-2']);

    expect([...constraints.keys()].sort()).toEqual(['acc-1', 'acc-2']);
  });

  it('omits the accounts of another user (INV-9)', async () => {
    const store = await storeWith([{ accountId: 'theirs', userId: 'user-2' }]);
    const reader = new ReadModelAccountConstraintsReader(store);

    const constraints = await reader.byIds('user-1', ['theirs']);

    expect(constraints.size).toBe(0);
  });

  it('returns an empty map when no id matches, leaving the verdict to the caller', async () => {
    const store = await storeWith([]);
    const reader = new ReadModelAccountConstraintsReader(store);

    await expect(reader.byIds('user-1', ['ghost'])).resolves.toEqual(new Map());
  });

  it('returns the facts a posting is validated against, never a verdict', async () => {
    const store = await storeWith([
      { accountId: 'acc-1', closedOn: '2026-06-30', currencyCode: null, isSystem: true },
    ]);
    const reader = new ReadModelAccountConstraintsReader(store);

    const constraints = await reader.byIds('user-1', ['acc-1']);

    expect(constraints.get('acc-1')).toEqual({
      accountId: 'acc-1',
      name: 'Assets:acc-1',
      type: 'ASSETS',
      // Null means "accepts any currency", which is what the column means; the
      // rule that reads it lives in the domain (rules Art. 12).
      currency: null,
      openedOn: '2026-01-01',
      closedOn: '2026-06-30',
      isSystem: true,
    });
  });

  it('does not query at all when there is nothing to validate', async () => {
    const store = await storeWith([{ accountId: 'acc-1' }]);
    const query = jest.spyOn(store, 'query');
    const reader = new ReadModelAccountConstraintsReader(store);

    await expect(reader.byIds('user-1', [])).resolves.toEqual(new Map());
    expect(query).not.toHaveBeenCalled();
  });
});
