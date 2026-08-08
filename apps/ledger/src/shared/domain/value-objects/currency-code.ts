import { InvalidCurrencyCodeException } from './value-object.exception';

const ISO_4217 = /^[A-Z]{3}$/;

/**
 * A currency identifier, normalized to upper case (`COP`, `USD`). Its precision
 * (minor units) is resolved separately through the {@link CurrencyCatalog}; this
 * VO carries only the code so it can travel in payloads without a scale.
 */
export class CurrencyCode {
  private constructor(private readonly raw: string) {}

  static of(raw: string): CurrencyCode {
    const normalized = raw?.trim().toUpperCase() ?? '';

    if (!ISO_4217.test(normalized)) {
      throw new InvalidCurrencyCodeException(`Invalid currency code: ${raw}`);
    }

    return new CurrencyCode(normalized);
  }

  get value(): string {
    return this.raw;
  }

  equals(other: CurrencyCode): boolean {
    return other ? this.raw === other.raw : false;
  }

  toString(): string {
    return this.raw;
  }
}
