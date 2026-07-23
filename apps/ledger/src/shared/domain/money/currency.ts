import { InvalidCurrencyException } from './money.exception';

/**
 * A currency with its minor-unit precision (COP → 0, USD → 2). Seed value
 * object keeping `(amount, currency)` inseparable (spec §9.4.1); the full
 * registry (CurrencyRegistered, §2.5) arrives in EP-1.1.
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

  /** Identity is the ISO code until the EP-1.1 registry exists. */
  equals(other: Currency): boolean {
    return this.code === other.code;
  }
}
