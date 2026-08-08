/**
 * Reads the user's ledger settings from `proj_ledger_settings`. Reconciliation
 * needs the IANA timezone to resolve day boundaries.
 */
export abstract class LedgerSettingsReader {
  abstract timezoneOf(userId: string): Promise<string>;
}
