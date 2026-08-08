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
