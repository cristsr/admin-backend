/**
 * Reload hook for a {@link CurrencyCatalog} served from a projection.
 *
 * `CurrencyCatalog.resolve` is synchronous — it runs during stream rehydration,
 * where nothing can await — so a projection-backed catalog has to keep the rows
 * in memory. Registering a currency therefore writes `proj_currencies` *and*
 * reloads that cache; without the reload the freshly registered currency stays
 * unusable until the process restarts, which makes `POST /currencies` look like
 * it worked while nothing can be booked in the new currency.
 */
export abstract class CurrencyCatalogCache {
  /** Reloads the in-memory view from its backing projection. */
  abstract refresh(): Promise<void>;
}
