import { Currency } from './currency';
import { InvalidCurrencyException } from './money.exception';

describe('Currency', () => {
  it('normalizes the code to uppercase and keeps its minor units', () => {
    const usd = Currency.of('usd', 2);

    expect(usd.code).toBe('USD');
    expect(usd.minorUnits).toBe(2);
  });

  it('rejects blank currency codes', () => {
    expect(() => Currency.of('', 2)).toThrow(InvalidCurrencyException);
    expect(() => Currency.of('   ', 2)).toThrow(InvalidCurrencyException);
  });

  it('rejects negative and non-integer minor units', () => {
    expect(() => Currency.of('USD', -1)).toThrow(InvalidCurrencyException);
    expect(() => Currency.of('USD', 2.5)).toThrow(InvalidCurrencyException);
  });
});
