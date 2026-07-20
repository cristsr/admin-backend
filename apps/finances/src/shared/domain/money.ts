import { CurrencyMismatchException, InvalidMoneyException } from './money.exception';

/** Money is stored and compared with two decimals, the precision of the ledger. */
const DECIMALS = 2;

const SCALE = 10 ** DECIMALS;

/**
 * An amount tied to the currency it is expressed in. Immutable: every operation
 * returns a new instance, so an amount can never be mutated behind the back of
 * whoever holds it.
 *
 * Combining two amounts requires them to share a currency — the alternative is
 * a number that silently means nothing. Crossing currencies is only possible
 * through {@link convertTo}, which demands an explicit rate.
 */
export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isFinite(amount)) {
      throw new InvalidMoneyException(`"${amount}" is not a valid amount`);
    }

    if (!currency?.trim()) {
      throw new InvalidMoneyException('Money requires a currency');
    }

    return new Money(Money.round(amount), currency.trim().toUpperCase());
  }

  static zero(currency: string): Money {
    return Money.of(0, currency);
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.of(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.of(this.amount - other.amount, this.currency);
  }

  /**
   * Restates the amount in another currency. The rate is passed in rather than
   * looked up, so the domain stays free of the exchange provider and the caller
   * stays in control of which date's rate applies.
   */
  convertTo(currency: string, rate: number): Money {
    if (rate <= 0) {
      throw new InvalidMoneyException(
        `Exchange rate must be positive, received "${rate}"`,
      );
    }

    return Money.of(this.amount * rate, currency);
  }

  /**
   * How much of `total` this amount represents, floored — a budget at 99.6% has
   * not reached 100% yet. Returns 0 for a zero total instead of NaN.
   */
  percentageOf(total: Money): number {
    this.ensureSameCurrency(total);

    if (!total.amount) return 0;

    return Math.floor((this.amount / total.amount) * 100);
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  isZero(): boolean {
    return !this.amount;
  }

  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.amount > other.amount;
  }

  isSameCurrency(other: Money): boolean {
    return this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount.toFixed(DECIMALS)} ${this.currency}`;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.isSameCurrency(other)) return;

    throw new CurrencyMismatchException(
      `Cannot operate on ${this.currency} and ${other.currency} without converting first`,
    );
  }

  private static round(amount: number): number {
    return Math.round((amount + Number.EPSILON) * SCALE) / SCALE;
  }
}
