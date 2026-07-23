/**
 * Money in base presentation currency after FX conversion.
 * Stored as decimal string (INV-8).
 */
export class ValuedAmount {
  private constructor(
    readonly amount: string,
    readonly presentationCurrency: string,
  ) {}

  static of(amount: string, presentationCurrency: string): ValuedAmount {
    if (!amount.match(/^-?\d+(\.\d+)?$/)) {
      throw new Error(`ValuedAmount must be decimal, got ${amount}`);
    }
    return new ValuedAmount(amount, presentationCurrency);
  }

  toString(): string {
    return this.amount;
  }
}
