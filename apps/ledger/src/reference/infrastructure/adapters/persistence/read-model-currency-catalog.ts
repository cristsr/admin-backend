import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria } from '@shared';
import { CurrencyCatalogCache } from '@ledger/reference/application/ports/currency-catalog-cache.port';
import {
  CurrencyRow,
  PROJ_CURRENCIES,
} from '@ledger/reference/infrastructure/projections/currencies.schema';
import { Currency } from '@ledger/shared/domain/money';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects/currency-catalog';
import { CurrencyCode } from '@ledger/shared/domain/value-objects/currency-code';
import { UnknownCurrencyException } from '@ledger/shared/domain/value-objects/value-object.exception';

/**
 * ISO-4217 currencies the ledger can always resolve, even against an empty
 * catalog or right after a rebuild.
 *
 * They live here rather than in a migration on purpose: `rebuild currencies`
 * truncates the projection and replays the stream, so seed rows inserted by a
 * migration would vanish on the first rebuild. Keeping them in the adapter makes
 * them survive anything.
 */
const BASE_CURRENCIES: Readonly<Record<string, number>> = { COP: 0, USD: 2 };

/**
 * Serves {@link CurrencyCatalog} from `proj_currencies`.
 *
 * **`resolve` stays synchronous** — 22 call sites depend on it, including
 * `fromPayload` of every event carrying money, i.e. stream rehydration. Making
 * it async would break loading any aggregate with amounts. So the projection is
 * read into an in-memory cache and served from there; `refresh()` reloads it
 * after a registration.
 */
export class ReadModelCurrencyCatalog extends CurrencyCatalog implements CurrencyCatalogCache {
  private readonly cache = new Map<string, number>();

  constructor(private readonly store: ReadModelStore) {
    super();
  }

  /** Loads the projection into the cache. Call on boot and after a registration. */
  async refresh(): Promise<void> {
    const rows = await this.store.query<CurrencyRow>(PROJ_CURRENCIES, Criteria.none());

    this.cache.clear();

    for (const row of rows) {
      this.cache.set(row.code, Number(row.minor_units));
    }
  }

  resolve(code: CurrencyCode): Currency {
    const registered = this.cache.get(code.value) ?? BASE_CURRENCIES[code.value];

    if (registered === undefined) {
      throw new UnknownCurrencyException(`No currency registered for "${code.value}"`);
    }

    return Currency.of(code.value, registered);
  }
}
