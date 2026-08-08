import { CurrencyCatalogCache } from '@ledger/reference/application/ports/currency-catalog-cache.port';

/**
 * Cache of a catalog that is not projection-backed — the seeded catalogs the
 * in-memory compositions use. There is nothing to reload, so refreshing is a
 * no-op rather than a special case in the handler.
 *
 * It lives here, next to its only caller, rather than in `application/ports/`:
 * that folder holds contracts, and a concrete class sitting in it invites the
 * next no-op implementation to land there too.
 */
export class StaticCurrencyCatalogCache extends CurrencyCatalogCache {
  refresh(): Promise<void> {
    return Promise.resolve();
  }
}
