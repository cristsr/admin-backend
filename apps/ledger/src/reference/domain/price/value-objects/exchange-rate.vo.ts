/**
 * Dated FX observation: rate as decimal string (never number, INV-8).
 */
export class ExchangeRate {
  private constructor(private readonly value: string) {}

  static of(value: string): ExchangeRate {
    if (typeof value !== 'string' || !value.match(/^\d+(\.\d+)?$/)) {
      throw new Error(`ExchangeRate must be a decimal string, got ${value}`);
    }
    return new ExchangeRate(value);
  }

  toString(): string {
    return this.value;
  }
}
