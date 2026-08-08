import { CurrencyView } from '@ledger/reference/application/views/currency.view';

/**
 * Read port over the reference currency catalog.
 *
 * The one read that is not partitioned by user: a currency's precision is
 * universal, so INV-9 does not apply and no `userId` parameter belongs in
 * this signature — the deliberate exception to the naming rule.
 *
 * Writes are deliberately absent: `CurrenciesProjector` is the only writer
 * and it goes through the shared `ReadModelStore` (rules Art. 10).
 */
export abstract class CurrencyCatalogFinder {
  abstract all(): Promise<readonly CurrencyView[]>;
}
