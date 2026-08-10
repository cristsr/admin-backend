import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PROJ_LEDGER_SETTINGS } from '@ledger/ledger/infrastructure/projections/ledger-settings.schema';
import { ReadModelLedgerSettingsFinder } from './read-model-ledger-settings-finder';

const row = {
  user_id: 'user-1',
  presentation_currency: 'USD',
  timezone: 'America/Bogota',
  opening_balances_account_id: 'acc-opening',
  adjustments_account_id: 'acc-adjustments',
  is_initialized: true,
};

async function finderWith(userIds: readonly string[]): Promise<ReadModelLedgerSettingsFinder> {
  const store = new InMemoryReadModelStore();

  for (const [, userId] of userIds.entries()) {
    await store.upsert(PROJ_LEDGER_SETTINGS, { user_id: userId }, { ...row, user_id: userId });
  }

  return new ReadModelLedgerSettingsFinder(store);
}

describe('ReadModelLedgerSettingsFinder', () => {
  it('returns the settings of the requesting user', async () => {
    const finder = await finderWith(['user-1']);

    const settings = await finder.byUser('user-1');

    expect(settings).toEqual({
      presentationCurrency: 'USD',
      timezone: 'America/Bogota',
      isInitialized: true,
    });
  });

  it('returns null when the ledger was never initialized', async () => {
    const finder = await finderWith([]);

    const settings = await finder.byUser('user-1');

    expect(settings).toBeNull();
  });

  it('never exposes the system account ids', async () => {
    const finder = await finderWith(['user-1']);

    const settings = await finder.byUser('user-1');

    expect(settings).not.toHaveProperty('openingBalancesAccountId'); // INV-13
    expect(settings).not.toHaveProperty('adjustmentsAccountId');
  });
});
