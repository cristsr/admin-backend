import { CurrencyCode } from './currency-code';
import { InvalidCurrencyCodeException } from './value-object.exception';

describe('CurrencyCode', () => {
  it('normalizes to upper case and trims', () => {
    expect(CurrencyCode.of('  usd ').value).toBe('USD');
  });

  it('rejects a blank code', () => {
    expect(() => CurrencyCode.of('')).toThrow(InvalidCurrencyCodeException);
    expect(() => CurrencyCode.of('   ')).toThrow(InvalidCurrencyCodeException);
  });

  it('rejects anything that is not three letters', () => {
    expect(() => CurrencyCode.of('XX')).toThrow(InvalidCurrencyCodeException);
    expect(() => CurrencyCode.of('XXXX')).toThrow(InvalidCurrencyCodeException);
    expect(() => CurrencyCode.of('Co1')).toThrow(InvalidCurrencyCodeException);
    expect(() => CurrencyCode.of('USD2')).toThrow(InvalidCurrencyCodeException);
  });

  it('compares by normalized value', () => {
    expect(CurrencyCode.of('cop').equals(CurrencyCode.of('COP'))).toBe(true);
    expect(CurrencyCode.of('cop').equals(CurrencyCode.of('usd'))).toBe(false);
  });
});
