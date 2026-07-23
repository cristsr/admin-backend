import { LedgerSettingsProjector } from './ledger-settings.projector';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { LedgerInitialized } from '../../../ledger/domain/settings/events/ledger-initialized.event';
import { PresentationCurrencyChanged, TimezoneChanged } from '../../domain/ledger-settings/events';

describe('LedgerSettingsProjector', () => {
  let projector: LedgerSettingsProjector;
  let mockReadModelStore: jest.Mocked<ReadModelStore>;

  beforeEach(() => {
    mockReadModelStore = {
      upsert: jest.fn().mockResolvedValue(void 0),
      delete: jest.fn().mockResolvedValue(void 0),
      truncate: jest.fn().mockResolvedValue(void 0),
      query: jest.fn().mockResolvedValue([]),
    } as any;

    projector = new LedgerSettingsProjector(mockReadModelStore);
  });

  describe('project()', () => {
    it('should insert row on LedgerInitialized', async () => {
      const userId = 'user-123';
      const event = new LedgerInitialized({
        presentationCurrency: 'COP',
        timezone: 'America/Bogota',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      });

      await projector.project(event);

      expect(mockReadModelStore.upsert).toHaveBeenCalledWith(
        'proj_ledger_settings',
        'user-123',
        expect.objectContaining({
          user_id: 'user-123',
          presentation_currency: 'COP',
          timezone: 'America/Bogota',
        }),
      );
    });

    it('should update currency on PresentationCurrencyChanged', async () => {
      const event = new PresentationCurrencyChanged('user-123', 'USD');

      await projector.project(event);

      expect(mockReadModelStore.upsert).toHaveBeenCalledWith(
        'proj_ledger_settings',
        'user-123',
        expect.objectContaining({
          presentation_currency: 'USD',
        }),
      );
    });

    it('should update timezone on TimezoneChanged', async () => {
      const event = new TimezoneChanged('user-123', 'UTC');

      await projector.project(event);

      expect(mockReadModelStore.upsert).toHaveBeenCalledWith(
        'proj_ledger_settings',
        'user-123',
        expect.objectContaining({
          timezone: 'UTC',
        }),
      );
    });

    it('should rebuild deterministically', async () => {
      const userId = 'user-123';
      const events = [
        new LedgerInitialized({
          presentationCurrency: 'COP',
          timezone: 'America/Bogota',
          openingBalancesAccountId: 'acc-1',
          adjustmentsAccountId: 'acc-2',
        }),
        new PresentationCurrencyChanged(userId, 'USD'),
        new TimezoneChanged(userId, 'UTC'),
      ];

      for (const event of events) {
        await projector.project(event);
      }

      // Should have 3 calls (one init, two updates)
      expect(mockReadModelStore.upsert).toHaveBeenCalledTimes(3);
    });
  });
});
