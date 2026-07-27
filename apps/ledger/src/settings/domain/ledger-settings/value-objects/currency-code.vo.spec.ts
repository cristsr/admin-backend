import { InvalidCurrencyCodeException } from '../exceptions';
import { CurrencyCode } from './currency-code.vo';

describe('CurrencyCode (Value Object)', () => {
  describe('of()', () => {
    it('should accept valid ISO-4217 codes (COP, USD, EUR)', () => {
      const cop = CurrencyCode.of('COP');
      const usd = CurrencyCode.of('USD');
      const eur = CurrencyCode.of('EUR');

      expect(cop.toString()).toBe('COP');
      expect(usd.toString()).toBe('USD');
      expect(eur.toString()).toBe('EUR');
    });

    it('should reject empty string', () => {
      expect(() => CurrencyCode.of('')).toThrow(InvalidCurrencyCodeException);
    });

    it('should reject whitespace-only string', () => {
      expect(() => CurrencyCode.of('   ')).toThrow(InvalidCurrencyCodeException);
    });

    it('should reject invalid format (not 3 letters)', () => {
      expect(() => CurrencyCode.of('XX')).toThrow(InvalidCurrencyCodeException);
      expect(() => CurrencyCode.of('XXXX')).toThrow(InvalidCurrencyCodeException);
      expect(() => CurrencyCode.of('Co1')).toThrow(InvalidCurrencyCodeException);
      expect(() => CurrencyCode.of('USD2')).toThrow(InvalidCurrencyCodeException);
    });

    it('should normalize lowercase to uppercase', () => {
      const cop = CurrencyCode.of('cop');
      expect(cop.toString()).toBe('COP');
    });
  });

  describe('equals()', () => {
    it('should return true for identical codes', () => {
      const cop1 = CurrencyCode.of('COP');
      const cop2 = CurrencyCode.of('COP');
      expect(cop1.equals(cop2)).toBe(true);
    });

    it('should return false for different codes', () => {
      const cop = CurrencyCode.of('COP');
      const usd = CurrencyCode.of('USD');
      expect(cop.equals(usd)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      const cop = CurrencyCode.of('COP');
      expect(cop.equals(null)).toBe(false);
      expect(cop.equals(undefined)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return the currency code string', () => {
      const cop = CurrencyCode.of('COP');
      expect(cop.toString()).toBe('COP');
    });
  });
});
