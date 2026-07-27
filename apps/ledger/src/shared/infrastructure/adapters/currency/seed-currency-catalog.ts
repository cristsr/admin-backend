import { Currency } from '@ledger/shared/domain/money';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects/currency-catalog';
import { CurrencyCode } from '@ledger/shared/domain/value-objects/currency-code';
import { UnknownCurrencyException } from '@ledger/shared/domain/value-objects/value-object.exception';

/** Minor-unit precision of the seed currencies until EP-4 registers more. */
const SEED_MINOR_UNITS: Readonly<Record<string, number>> = {
  COP: 0,
  USD: 2,
};

/**
 * Fixed catalog seeding `{ COP: 0, USD: 2 }` (roadmap decision). EP-4 replaces
 * it with a projection fed by `CurrencyRegistered`, without touching the core.
 */
export class SeedCurrencyCatalog extends CurrencyCatalog {
  resolve(code: CurrencyCode): Currency {
    const minorUnits = SEED_MINOR_UNITS[code.value];

    if (minorUnits === undefined) {
      throw new UnknownCurrencyException(`No currency registered for "${code.value}"`);
    }

    return Currency.of(code.value, minorUnits);
  }
}
