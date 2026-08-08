import { Big } from './big.config';
import { Currency } from './currency';
import {
  CurrencyMismatchException,
  InvalidMoneyException,
  MoneyScaleException,
} from './money.exception';

/**
 * Accepted shape of a money literal: optional sign, integer part, optional
 * fraction. Deliberately stricter than big.js itself — no exponential
 * notation, no leading `+`, no hex/octal quirks.
 */
const DECIMAL_LITERAL = /^-?\d+(\.\d+)?$/;

/**
 * An exact decimal amount bound to its currency. Immutable: every operation
 * returns a new instance. Constructing from `number` is forbidden (INV-8) —
 * `of` only accepts a decimal string, and the internal `Big` runs in
 * `Big.strict` mode so a numeric value never enters the arithmetic.
 */
export class Money {
  private constructor(
    private readonly value: Big,
    readonly currency: Currency,
  ) {}

  /**
   * Builds from an exact decimal string, e.g. `"31900"`, `"-7.99"`. The
   * amount's scale must not exceed the currency `minorUnits`:
   * `"100.5"` for a 0-decimal COP is rejected. Never accepts a `number`.
   */
  static of(amount: string, currency: Currency): Money {
    if (typeof amount !== 'string') {
      throw new InvalidMoneyException('Money amounts must be decimal strings, never numbers');
    }

    const literal = amount.trim();

    if (!DECIMAL_LITERAL.test(literal)) {
      throw new InvalidMoneyException(`"${amount}" is not a valid decimal amount`);
    }

    if (Money.scaleOf(literal) > currency.minorUnits) {
      throw new MoneyScaleException(
        `"${literal}" exceeds the ${currency.minorUnits} decimal place(s) of ${currency.code}`,
      );
    }

    return new Money(new Big(literal), currency);
  }

  static zero(currency: Currency): Money {
    return new Money(new Big('0'), currency);
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  negate(): Money {
    return new Money(this.value.times('-1'), this.currency);
  }

  isZero(): boolean {
    return this.value.eq('0');
  }

  isNegative(): boolean {
    return this.value.lt('0');
  }

  equals(other: Money): boolean {
    return this.currency.equals(other.currency) && this.value.eq(other.value);
  }

  compareTo(other: Money): -1 | 0 | 1 {
    this.ensureSameCurrency(other);
    return this.value.cmp(other.value);
  }

  /** Exact decimal string for event payloads / DTOs / NUMERIC columns. */
  toDecimalString(): string {
    return this.value.toFixed();
  }

  toString(): string {
    return `${this.toDecimalString()} ${this.currency.code}`;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency.equals(other.currency)) return;

    throw new CurrencyMismatchException(
      `Cannot operate on ${this.currency.code} and ${other.currency.code} without converting first`,
    );
  }

  /**
   * Effective decimal places of a validated literal: trailing zeros carry no
   * precision, so `"100.0"` fits a 0-decimal currency while `"100.5"` does not.
   */
  private static scaleOf(literal: string): number {
    const fraction = literal.split('.')[1];

    return fraction ? fraction.replace(/0+$/, '').length : 0;
  }
}
