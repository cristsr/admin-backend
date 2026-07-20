import { Money } from './money';
import { CurrencyMismatchException, InvalidMoneyException } from './money.exception';

describe('Money', () => {
  it('normalizes the currency code and rounds to two decimals', () => {
    const money = Money.of(10.005, ' usd ');

    expect(money.currency).toBe('USD');
    expect(money.amount).toBe(10.01);
  });

  it('rejects an amount that is not a finite number', () => {
    expect(() => Money.of(NaN, 'USD')).toThrow(InvalidMoneyException);
    expect(() => Money.of(Infinity, 'USD')).toThrow(InvalidMoneyException);
  });

  it('rejects a blank currency', () => {
    expect(() => Money.of(10, '  ')).toThrow(InvalidMoneyException);
  });

  it('is immutable: operations return a new instance', () => {
    const original = Money.of(100, 'USD');
    const result = original.add(Money.of(50, 'USD'));

    expect(original.amount).toBe(100);
    expect(result.amount).toBe(150);
    expect(result).not.toBe(original);
  });

  it('refuses to combine different currencies', () => {
    const usd = Money.of(100, 'USD');
    const cop = Money.of(100, 'COP');

    expect(() => usd.add(cop)).toThrow(CurrencyMismatchException);
    expect(() => usd.subtract(cop)).toThrow(CurrencyMismatchException);
    expect(() => usd.isGreaterThan(cop)).toThrow(CurrencyMismatchException);
  });

  it('converts with an explicit rate', () => {
    const converted = Money.of(2, 'USD').convertTo('COP', 4000);

    expect(converted.amount).toBe(8000);
    expect(converted.currency).toBe('COP');
  });

  it('refuses a non-positive exchange rate', () => {
    expect(() => Money.of(2, 'USD').convertTo('COP', 0)).toThrow(
      InvalidMoneyException,
    );
    expect(() => Money.of(2, 'USD').convertTo('COP', -1)).toThrow(
      InvalidMoneyException,
    );
  });

  it('floors the percentage: 99.6% has not reached 100%', () => {
    expect(Money.of(99.6, 'USD').percentageOf(Money.of(100, 'USD'))).toBe(99);
    expect(Money.of(80, 'USD').percentageOf(Money.of(100, 'USD'))).toBe(80);
  });

  it('reports 0% against a zero total instead of NaN', () => {
    expect(Money.of(50, 'USD').percentageOf(Money.zero('USD'))).toBe(0);
  });

  it('keeps cent arithmetic exact', () => {
    const result = Money.of(0.1, 'USD').add(Money.of(0.2, 'USD'));

    expect(result.amount).toBe(0.3);
  });
});
