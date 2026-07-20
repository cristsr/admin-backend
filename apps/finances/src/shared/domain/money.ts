import { CurrencyMismatchException, InvalidMoneyException } from './money.exception';

/** Money is stored and compared with two decimals, the precision of the ledger. */
const DECIMALS = 2;

const SCALE = 10 ** DECIMALS;

/**
 * An amount tied to its currency. Immutable: every operation returns a new
 * instance; combining two amounts requires a shared currency.
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

  /** Restates the amount in another currency; the rate is supplied by the caller. */
  convertTo(currency: string, rate: number): Money {
    if (rate <= 0) {
      throw new InvalidMoneyException(
        `Exchange rate must be positive, received "${rate}"`,
      );
    }

    return Money.of(this.amount * rate, currency);
  }

  /** Percentage of `total`, floored; returns 0 for a zero total instead of NaN. */
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
