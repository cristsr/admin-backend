import { LedgerSettings } from './ledger-settings.aggregate';
import { LedgerInitialized } from './events/ledger-initialized.event';
import { PresentationCurrencyChanged, TimezoneChanged } from '../../../settings/domain/ledger-settings/events';
import { CurrencyCode, IanaTimeZone } from '../../../settings/domain/ledger-settings/value-objects';

describe('LedgerSettings (Aggregate)', () => {
  const userId = 'user-123';

  describe('initialize()', () => {
    it('should emit LedgerInitialized with presentation currency and timezone', () => {
      const result = LedgerSettings.initialize({
        userId,
        presentationCurrency: 'COP',
        timezone: 'America/Bogota',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      });

      expect(result.isInitialized).toBe(true);
      expect(result.hasUncommittedChanges).toBe(true);
      const changes = result.pullChanges();
      expect(changes.length).toBe(1);
      expect(changes[0]).toBeInstanceOf(LedgerInitialized);
    });
  });

  describe('changePresentationCurrency()', () => {
    it('should emit PresentationCurrencyChanged when currency differs', () => {
      const settings = LedgerSettings.initialize({
        userId,
        presentationCurrency: 'COP',
        timezone: 'America/Bogota',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      });

      // Clear uncommitted events from initialization
      settings.pullChanges();

      const newCurrency = CurrencyCode.of('USD');
      settings.changePresentationCurrency(newCurrency);

      expect(settings.hasUncommittedChanges).toBe(true);
      const changes = settings.pullChanges();
      expect(changes.length).toBe(1);
      expect(changes[0]).toBeInstanceOf(PresentationCurrencyChanged);
      expect((changes[0] as PresentationCurrencyChanged).presentationCurrency).toBe('USD');
    });

    it('should not emit event if currency is unchanged (idempotent)', () => {
      const settings = LedgerSettings.initialize({
        userId,
        presentationCurrency: 'COP',
        timezone: 'America/Bogota',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      });

      settings.pullChanges();

      const sameCurrency = CurrencyCode.of('COP');
      settings.changePresentationCurrency(sameCurrency);

      expect(settings.hasUncommittedChanges).toBe(false);
    });
  });

  describe('changeTimezone()', () => {
    it('should emit TimezoneChanged when timezone differs', () => {
      const settings = LedgerSettings.initialize({
        userId,
        presentationCurrency: 'COP',
        timezone: 'America/Bogota',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      });

      settings.pullChanges();

      const newTimezone = IanaTimeZone.of('UTC');
      settings.changeTimezone(newTimezone);

      expect(settings.hasUncommittedChanges).toBe(true);
      const changes = settings.pullChanges();
      expect(changes.length).toBe(1);
      expect(changes[0]).toBeInstanceOf(TimezoneChanged);
      expect((changes[0] as TimezoneChanged).timezone).toBe('UTC');
    });

    it('should not emit event if timezone is unchanged (idempotent)', () => {
      const settings = LedgerSettings.initialize({
        userId,
        presentationCurrency: 'COP',
        timezone: 'America/Bogota',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      });

      settings.pullChanges();

      const sameTimezone = IanaTimeZone.of('America/Bogota');
      settings.changeTimezone(sameTimezone);

      expect(settings.hasUncommittedChanges).toBe(false);
    });
  });

  describe('rehydrate()', () => {
    it('should rebuild state from event history including change events', () => {
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

      const settings = LedgerSettings.rehydrate(userId, events);

      expect(settings.isInitialized).toBe(true);
      expect(settings.hasUncommittedChanges).toBe(false);
      expect(settings.version).toBe(3);
    });
  });

  describe('idempotency domain-level', () => {
    it('should allow same change multiple times without duplicating events', () => {
      const settings = LedgerSettings.initialize({
        userId,
        presentationCurrency: 'COP',
        timezone: 'America/Bogota',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      });

      settings.pullChanges();

      const newCurrency = CurrencyCode.of('USD');
      settings.changePresentationCurrency(newCurrency);
      settings.changePresentationCurrency(newCurrency); // same again
      settings.changePresentationCurrency(newCurrency); // same again

      // Only first change should emit event
      const changes = settings.pullChanges();
      expect(changes.length).toBe(1);
    });
  });
});
