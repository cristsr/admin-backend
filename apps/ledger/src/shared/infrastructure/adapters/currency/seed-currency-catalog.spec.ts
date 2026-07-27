import { CurrencyCode } from '@ledger/shared/domain/value-objects/currency-code';
import { UnknownCurrencyException } from '@ledger/shared/domain/value-objects/value-object.exception';
import { SeedCurrencyCatalog } from './seed-currency-catalog';

describe('SeedCurrencyCatalog', () => {
  const catalog = new SeedCurrencyCatalog();

  it('resolves the seed currencies with their minor units', () => {
    expect(catalog.resolve(CurrencyCode.of('COP')).minorUnits).toBe(0);
    expect(catalog.resolve(CurrencyCode.of('USD')).minorUnits).toBe(2);
  });

  it('throws for an unregistered currency', () => {
    expect(() => catalog.resolve(CurrencyCode.of('EUR'))).toThrow(UnknownCurrencyException);
  });
});
