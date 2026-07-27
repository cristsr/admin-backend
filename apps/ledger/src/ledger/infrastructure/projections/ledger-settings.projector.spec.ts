import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { LedgerSettingsProjector, PROJ_LEDGER_SETTINGS } from './ledger-settings.projector';

const AT = new Date('2026-07-22T10:00:00.000Z');

const anEvent = (eventType: string, payload: Record<string, unknown>): StoredEvent =>
  ({
    eventId: `evt-${eventType}`,
    userId: 'user-1',
    aggregateType: 'Ledger',
    aggregateId: 'user-1',
    sequence: 1,
    eventType,
    schemaVersion: 1,
    clientId: 'client-1',
    externalRef: null,
    payload,
    occurredAt: AT,
    recordedAt: AT,
    globalPosition: 1n,
  }) as StoredEvent;

const initialized = anEvent('LedgerInitialized', {
  presentationCurrency: 'COP',
  timezone: 'America/Bogota',
  openingBalancesAccountId: 'acc-opening',
  adjustmentsAccountId: 'acc-adjust',
});

describe('LedgerSettingsProjector', () => {
  let store: InMemoryReadModelStore;
  const projector = new LedgerSettingsProjector();

  const row = async () => {
    const rows = await store.query<Record<string, unknown>>(
      PROJ_LEDGER_SETTINGS,
      Criteria.none().equals('user_id', 'user-1'),
    );

    return rows[0];
  };

  beforeEach(() => {
    store = new InMemoryReadModelStore();
  });

  it('consumes the three settings events (AC-9)', () => {
    expect(projector.consumes).toEqual([
      'LedgerInitialized',
      'PresentationCurrencyChanged',
      'TimezoneChanged',
    ]);
  });

  it('writes the full row on LedgerInitialized', async () => {
    await projector.project(initialized, store);

    expect(await row()).toMatchObject({
      user_id: 'user-1',
      presentation_currency: 'COP',
      timezone: 'America/Bogota',
      opening_balances_account_id: 'acc-opening',
      adjustments_account_id: 'acc-adjust',
      is_initialized: true,
    });
  });

  it('applies a currency change without losing the technical account ids', async () => {
    await projector.project(initialized, store);
    await projector.project(
      anEvent('PresentationCurrencyChanged', { userId: 'user-1', presentationCurrency: 'USD' }),
      store,
    );

    const current = await row();
    expect(current.presentation_currency).toBe('USD');
    // a partial write would have wiped these
    expect(current.opening_balances_account_id).toBe('acc-opening');
    expect(current.adjustments_account_id).toBe('acc-adjust');
    expect(current.timezone).toBe('America/Bogota');
  });

  it('applies a timezone change without losing the rest of the row', async () => {
    await projector.project(initialized, store);
    await projector.project(
      anEvent('TimezoneChanged', { userId: 'user-1', timezone: 'Europe/Madrid' }),
      store,
    );

    const current = await row();
    expect(current.timezone).toBe('Europe/Madrid');
    expect(current.presentation_currency).toBe('COP');
    expect(current.is_initialized).toBe(true);
  });

  it('applies both changes from the same replacement', async () => {
    await projector.project(initialized, store);
    await projector.project(
      anEvent('PresentationCurrencyChanged', { userId: 'user-1', presentationCurrency: 'USD' }),
      store,
    );
    await projector.project(
      anEvent('TimezoneChanged', { userId: 'user-1', timezone: 'Europe/Madrid' }),
      store,
    );

    expect(await row()).toMatchObject({
      presentation_currency: 'USD',
      timezone: 'Europe/Madrid',
      opening_balances_account_id: 'acc-opening',
    });
  });

  it('ignores a change on a ledger that was never initialized', async () => {
    await projector.project(
      anEvent('TimezoneChanged', { userId: 'user-1', timezone: 'Europe/Madrid' }),
      store,
    );

    expect(await row()).toBeUndefined();
  });

  it('is idempotent: replaying the stream yields the same row (RNF-5)', async () => {
    const change = anEvent('TimezoneChanged', {
      userId: 'user-1',
      timezone: 'Europe/Madrid',
    });

    await projector.project(initialized, store);
    await projector.project(change, store);
    const first = await row();

    await projector.project(initialized, store);
    await projector.project(change, store);

    expect(await row()).toEqual(first);
  });
});
