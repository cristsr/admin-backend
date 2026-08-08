import { LedgerSettingsView } from '@ledger/ledger/application/views/ledger-settings.view';

/**
 * Physical shape of `proj_ledger_settings`, declared next to the projector that
 * writes it and imported by every adapter that reads it — including the ones in
 * other modules (`reconciliation`, `accounts`). `LedgerSettingsProjector`
 * remains its only writer (rules Art. 10).
 *
 * The row carries the user's technical account ids; the {@link LedgerSettingsView}
 * they map to deliberately does not: those ids are an internal detail of how
 * opening balances and adjustments are booked, and nothing a client may post
 * against directly (INV-13). That asymmetry is exactly why the table is served
 * by a `Finder` (the API view) *and* a `Lookup` (the write side's technical
 * accounts) instead of one port.
 */
export const PROJ_LEDGER_SETTINGS = 'proj_ledger_settings';

/** One row of `proj_ledger_settings`, exactly as stored. */
export type LedgerSettingsRow = {
  readonly user_id: string;
  readonly presentation_currency: string;
  readonly timezone: string;
  readonly opening_balances_account_id: string;
  readonly adjustments_account_id: string;
  readonly is_initialized: boolean;
};

/** Maps a stored row to what goes over the wire. */
export function toLedgerSettingsView(row: LedgerSettingsRow): LedgerSettingsView {
  return {
    presentationCurrency: row.presentation_currency,
    timezone: row.timezone,
    isInitialized: row.is_initialized,
  };
}
