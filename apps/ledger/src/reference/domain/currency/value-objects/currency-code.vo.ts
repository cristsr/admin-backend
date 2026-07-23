/**
 * ISO 4217 currency code (e.g., "USD", "COP", "EUR").
 */
export class CurrencyCode {
  private constructor(readonly value: string) {}

  static of(code: string): CurrencyCode {
    const normalized = code.toUpperCase();
    if (!normalized.match(/^[A-Z]{3}$/)) {
      throw new Error(`CurrencyCode must be 3 uppercase letters, got ${code}`);
    }
    return new CurrencyCode(normalized);
  }

  toString(): string {
    return this.value;
  }
}
