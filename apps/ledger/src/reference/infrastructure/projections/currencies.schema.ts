import { CurrencyView } from '@ledger/reference/application/views/currency.view';

/**
 * Physical shape of `proj_currencies`, declared next to the projector that
 * writes it. `CurrenciesProjector` remains its only writer (rules Art. 10).
 *
 * Deliberately without `user_id`: a currency's decimal precision is
 * universal, not a per-user fact — the one projection in the ledger that is
 * global by design (INV-9 does not apply to reference data).
 */
export const PROJ_CURRENCIES = 'proj_currencies';

/** One row of `proj_currencies`, exactly as stored. */
export type CurrencyRow = {
  readonly code: string;
  readonly minor_units: number;
  readonly name: string;
  readonly registered_at: string;
};

/** Maps a stored row to what goes over the wire. */
export function toCurrencyView(row: CurrencyRow): CurrencyView {
  return {
    code: row.code,
    // Postgres returns SMALLINT as a string; the coercion belongs here, at
    // the edge, not in a use case.
    minorUnits: Number(row.minor_units),
    name: row.name,
  };
}
