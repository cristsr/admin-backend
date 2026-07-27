import { CurrencyCatalogAggregate } from './currency-catalog.aggregate';
import { CurrencyRegistered } from './events/currency-registered.event';
import {
  CurrencyPrecisionConflictException,
  InvalidMinorUnitsException,
} from './exceptions/currency.exception';

describe('CurrencyCatalogAggregate', () => {
  const emptyCatalog = () => CurrencyCatalogAggregate.rehydrate([]);

  it('registers a currency and raises the event', () => {
    const catalog = emptyCatalog();

    catalog.register('CLF', 4, 'Unidad de Fomento');

    const [event] = catalog.pullChanges();
    expect(event).toBeInstanceOf(CurrencyRegistered);
    expect((event as CurrencyRegistered).code).toBe('CLF');
    expect((event as CurrencyRegistered).minorUnits).toBe(4);
  });

  it('rehydrates its precisions from history', () => {
    const catalog = CurrencyCatalogAggregate.rehydrate([
      new CurrencyRegistered('CLF', 4, 'Unidad de Fomento'),
    ]);

    expect(catalog.precisionOf('CLF')).toBe(4);
  });

  describe('re-registration (AC-7)', () => {
    it('is a silent no-op when the precision is identical', () => {
      const catalog = CurrencyCatalogAggregate.rehydrate([
        new CurrencyRegistered('CLF', 4, 'Unidad de Fomento'),
      ]);

      catalog.register('CLF', 4, 'Unidad de Fomento');

      expect(catalog.pullChanges()).toHaveLength(0);
    });

    it('is rejected when the precision differs', () => {
      const catalog = CurrencyCatalogAggregate.rehydrate([
        new CurrencyRegistered('CLF', 4, 'Unidad de Fomento'),
      ]);

      // Changing it would turn every amount already recorded in CLF into a
      // different number (design principle #5).
      expect(() => catalog.register('CLF', 2, 'Unidad de Fomento')).toThrow(
        CurrencyPrecisionConflictException,
      );
    });

    it('reports CURRENCY_PRECISION_CONFLICT (RF-14)', () => {
      const catalog = CurrencyCatalogAggregate.rehydrate([new CurrencyRegistered('CLF', 4, 'UF')]);

      expect(() => catalog.register('CLF', 2, 'UF')).toThrow(
        expect.objectContaining({ code: 'CURRENCY_PRECISION_CONFLICT' }),
      );
    });
  });

  describe('minor units range (AC-6)', () => {
    it.each([0, 2, 4])('accepts %i, inside ISO-4217 range', (minorUnits) => {
      const catalog = emptyCatalog();

      catalog.register('XXX', minorUnits, 'Test');

      expect(catalog.pullChanges()).toHaveLength(1);
    });

    it.each([5, 6, 18])('rejects %i, beyond ISO-4217', (minorUnits) => {
      expect(() => emptyCatalog().register('XXX', minorUnits, 'Test')).toThrow(
        InvalidMinorUnitsException,
      );
    });

    it('rejects a negative precision', () => {
      expect(() => emptyCatalog().register('XXX', -1, 'Test')).toThrow(InvalidMinorUnitsException);
    });

    it('rejects a fractional precision', () => {
      expect(() => emptyCatalog().register('XXX', 2.5, 'Test')).toThrow(InvalidMinorUnitsException);
    });

    it('validates before checking for a conflict', () => {
      const catalog = CurrencyCatalogAggregate.rehydrate([new CurrencyRegistered('CLF', 4, 'UF')]);

      // An out-of-range value is invalid regardless of what is registered.
      expect(() => catalog.register('CLF', 9, 'UF')).toThrow(InvalidMinorUnitsException);
    });
  });

  it('keeps currencies independent', () => {
    const catalog = emptyCatalog();

    catalog.register('CLF', 4, 'Unidad de Fomento');
    catalog.register('JPY', 0, 'Yen');

    expect(catalog.precisionOf('CLF')).toBe(4);
    expect(catalog.precisionOf('JPY')).toBe(0);
  });
});
