import { Currency } from './currency';
import { Money } from './money';
import {
  CurrencyMismatchException,
  InvalidMoneyException,
  MoneyScaleException,
} from './money.exception';

const COP = Currency.of('COP', 0);
const USD = Currency.of('USD', 2);

describe('Money', () => {
  it('builds from a decimal string and echoes it back exactly', () => {
    expect(Money.of('31900', COP).toDecimalString()).toBe('31900');
    expect(Money.of('-7.99', USD).toDecimalString()).toBe('-7.99');
  });

  it('rejects construction from a number at runtime (INV-8)', () => {
    expect(() => Money.of(10.005 as any, USD)).toThrow(InvalidMoneyException);
  });

  it('rejects malformed and exponential literals', () => {
    expect(() => Money.of('abc', USD)).toThrow(InvalidMoneyException);
    expect(() => Money.of('1e3', USD)).toThrow(InvalidMoneyException);
    expect(() => Money.of('', USD)).toThrow(InvalidMoneyException);
  });

  it('rejects a scale beyond the currency minor units', () => {
    expect(() => Money.of('100.5', COP)).toThrow(MoneyScaleException);
    expect(() => Money.of('7.995', USD)).toThrow(MoneyScaleException);
  });

  it('accepts a scale within the currency minor units, ignoring trailing zeros', () => {
    expect(Money.of('7.99', USD).toDecimalString()).toBe('7.99');
    expect(Money.of('100.0', COP).toDecimalString()).toBe('100');
  });

  it('keeps cent arithmetic exact where float fails', () => {
    const result = Money.of('0.1', USD).add(Money.of('0.2', USD));

    expect(result.toDecimalString()).toBe('0.3');
  });

  it('adds and subtracts within the same currency', () => {
    const five = Money.of('5', USD);

    expect(five.add(Money.of('2.5', USD)).toDecimalString()).toBe('7.5');
    expect(five.subtract(Money.of('2.5', USD)).toDecimalString()).toBe('2.5');
  });

  it('refuses to combine different currencies', () => {
    expect(() => Money.of('1', USD).add(Money.of('1', COP))).toThrow(CurrencyMismatchException);
    expect(() => Money.of('1', USD).subtract(Money.of('1', COP))).toThrow(
      CurrencyMismatchException,
    );
    expect(() => Money.of('1', USD).compareTo(Money.of('1', COP))).toThrow(
      CurrencyMismatchException,
    );
  });

  it('is immutable: operations return a new instance', () => {
    const five = Money.of('5', USD);
    const seven = five.add(Money.of('2', USD));

    expect(seven).not.toBe(five);
    expect(five.toDecimalString()).toBe('5');
  });

  it('negates, compares and detects zero/negative', () => {
    expect(Money.of('5', USD).negate().toDecimalString()).toBe('-5');
    expect(Money.zero(USD).isZero()).toBe(true);
    expect(Money.of('-1', USD).isNegative()).toBe(true);
    expect(Money.of('2', USD).compareTo(Money.of('3', USD))).toBe(-1);
    expect(Money.of('3', USD).compareTo(Money.of('2', USD))).toBe(1);
    expect(Money.of('3', USD).compareTo(Money.of('3', USD))).toBe(0);
  });

  it('compares by value and currency on equality', () => {
    expect(Money.of('3.0', USD).equals(Money.of('3', USD))).toBe(true);
    expect(Money.of('3', USD).equals(Money.of('3', COP))).toBe(false);
  });

  it('serializes negative amounts as decimal strings for events', () => {
    expect(Money.of('-31900', COP).toDecimalString()).toBe('-31900');
    expect(Money.of('-31900', COP).toString()).toBe('-31900 COP');
  });
});
