import { InvalidCurrencyCodeException } from './value-object.exception';

/**
 * A currency identifier, normalized to upper case (`COP`, `USD`). Its precision
 * (minor units) is resolved separately through the {@link CurrencyCatalog}; this
 * VO carries only the code so it can travel in payloads without a scale.
 */
export class CurrencyCode {
  private constructor(private readonly raw: string) {}

  static of(raw: string): CurrencyCode {
    if (!raw?.trim()) {
      throw new InvalidCurrencyCodeException('Currency code must not be blank');
    }

    return new CurrencyCode(raw.trim().toUpperCase());
  }

  get value(): string {
    return this.raw;
  }

  equals(other: CurrencyCode): boolean {
    return this.raw === other.raw;
  }

  toString(): string {
    return this.raw;
  }
}
