/**
 * Number of decimal places for a currency (e.g., USD=2, COP=0).
 */
export class MinorUnits {
  private constructor(private readonly value: number) {}

  static of(value: number): MinorUnits {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`MinorUnits must be a non-negative integer, got ${value}`);
    }
    return new MinorUnits(value);
  }

  get value(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }
}
