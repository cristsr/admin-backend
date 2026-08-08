/** Read-model table name for the per-user ledger settings. */
export const PROJ_LEDGER_SETTINGS = 'proj_ledger_settings';

/** One row of `proj_ledger_settings`: the user's presentation settings and system accounts. */
export type LedgerSettingsRow = {
  readonly user_id: string;
  readonly presentation_currency: string;
  readonly timezone: string;
  readonly opening_balances_account_id: string;
  readonly adjustments_account_id: string;
  readonly is_initialized: boolean;
};

/**
 * The settings as the API exposes them. The system account ids stay out: they
 * are an internal detail of how opening balances and adjustments are booked,
 * and nothing a client may post against directly (INV-13).
 */
export type LedgerSettingsView = {
  readonly presentationCurrency: string;
  readonly timezone: string;
  readonly isInitialized: boolean;
};

/** Maps a stored row to what goes over the wire. */
export function toLedgerSettingsView(row: LedgerSettingsRow): LedgerSettingsView {
  return {
    presentationCurrency: row.presentation_currency,
    timezone: row.timezone,
    isInitialized: row.is_initialized,
  };
}
