import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PROJ_LEDGER_SETTINGS } from '@ledger/ledger/infrastructure/projections/ledger-settings.schema';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';
import { ReadModelLedgerTimezoneReader } from './read-model-ledger-timezone-reader';

async function readerWith(rows: readonly { user_id: string; timezone: string }[]): Promise<ReadModelLedgerTimezoneReader> {
  const store = new InMemoryReadModelStore();

  for (const { user_id, timezone } of rows) {
    await store.upsert(
      PROJ_LEDGER_SETTINGS,
      { user_id },
      {
        user_id,
        presentation_currency: 'USD',
        timezone,
        opening_balances_account_id: 'acc-opening',
        adjustments_account_id: 'acc-adjustments',
        is_initialized: true,
      },
    );
  }

  return new ReadModelLedgerTimezoneReader(store);
}

describe('ReadModelLedgerTimezoneReader', () => {
  it('returns the timezone of the requesting user', async () => {
    const reader = await readerWith([{ user_id: 'user-1', timezone: 'America/Bogota' }]);

    const timezone = await reader.timezoneOf('user-1');

    expect(timezone).toBe('America/Bogota');
  });

  it('fails with LedgerNotInitializedException when the ledger was never initialized', async () => {
    const reader = await readerWith([]);

    await expect(reader.timezoneOf('user-1')).rejects.toBeInstanceOf(LedgerNotInitializedException);
  });

  it('never answers another user timezone (INV-9)', async () => {
    const reader = await readerWith([
      { user_id: 'user-1', timezone: 'America/Bogota' },
      { user_id: 'user-2', timezone: 'UTC' },
    ]);

    const timezone = await reader.timezoneOf('user-1');

    expect(timezone).toBe('America/Bogota');
  });
});
