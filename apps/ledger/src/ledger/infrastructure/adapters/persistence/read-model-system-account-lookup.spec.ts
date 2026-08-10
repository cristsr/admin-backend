import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PROJ_LEDGER_SETTINGS } from '@ledger/ledger/infrastructure/projections/ledger-settings.schema';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';
import { ReadModelSystemAccountLookup } from './read-model-system-account-lookup';

const row = {
  user_id: 'user-1',
  presentation_currency: 'USD',
  timezone: 'America/Bogota',
  opening_balances_account_id: 'acc-opening-balances',
  adjustments_account_id: 'acc-adjustments',
  is_initialized: true,
};

async function lookupWith(rows: readonly { user_id: string }[]): Promise<ReadModelSystemAccountLookup> {
  const store = new InMemoryReadModelStore();

  for (const { user_id } of rows) {
    await store.upsert(PROJ_LEDGER_SETTINGS, { user_id }, { ...row, user_id });
  }

  return new ReadModelSystemAccountLookup(store);
}

describe('ReadModelSystemAccountLookup', () => {
  it('resolves the adjustments account', async () => {
    const lookup = await lookupWith([{ user_id: 'user-1' }]);

    const accountId = await lookup.adjustmentsAccountId('user-1');

    expect(accountId).toBe('acc-adjustments');
  });

  it('resolves the opening balances account', async () => {
    const lookup = await lookupWith([{ user_id: 'user-1' }]);

    const accountId = await lookup.openingBalancesAccountId('user-1');

    expect(accountId).toBe('acc-opening-balances');
  });

  it('fails with LedgerNotInitializedException when the ledger has no system accounts', async () => {
    const lookup = await lookupWith([]);

    await expect(lookup.adjustmentsAccountId('user-1')).rejects.toBeInstanceOf(
      LedgerNotInitializedException,
    );
    await expect(lookup.openingBalancesAccountId('user-1')).rejects.toBeInstanceOf(
      LedgerNotInitializedException,
    );
  });
});
