import { InvalidCurrencyException } from './money.exception';

/**
 * A currency with its minor-unit precision (COP → 0, USD → 2). Seed value
 * object keeping `(amount, currency)` inseparable; the registered catalog
 * resolves precision separately.
 */
export class Currency {
  private constructor(
    readonly code: string,
    readonly minorUnits: number,
  ) {}

  /** Rejects blank codes and negative/non-integer minor units. */
  static of(code: string, minorUnits: number): Currency {
    if (!code?.trim()) {
      throw new InvalidCurrencyException('Currency code must not be blank');
    }

    if (!Number.isInteger(minorUnits) || minorUnits < 0) {
      throw new InvalidCurrencyException(
        `Currency minor units must be a non-negative integer, received "${minorUnits}"`,
      );
    }

    return new Currency(code.trim().toUpperCase(), minorUnits);
  }

  /** Identity is the ISO code. */
  equals(other: Currency): boolean {
    return this.code === other.code;
  }
}
