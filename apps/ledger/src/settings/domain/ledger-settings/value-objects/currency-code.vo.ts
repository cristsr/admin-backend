import { InvalidCurrencyCodeException } from '../exceptions';

/**
 * ISO-4217-like currency code value object.
 * Must be a registered currency to be usable (EP-4.2).
 */
export class CurrencyCode {
  private constructor(private readonly value: string) {}

  /**
   * Construct from string. Validates format (3-letter code, uppercase).
   * @throws InvalidCurrencyCodeException if invalid
   */
  static of(value: string): CurrencyCode {
    if (!value || value.trim().length === 0) {
      throw new InvalidCurrencyCodeException('empty');
    }

    const normalized = value.toUpperCase();
    if (!normalized.match(/^[A-Z]{3}$/)) {
      throw new InvalidCurrencyCodeException(value);
    }

    return new CurrencyCode(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CurrencyCode | null | undefined): boolean {
    if (!other) return false;
    return this.value === other.value;
  }

  valueOf(): string {
    return this.value;
  }
}
