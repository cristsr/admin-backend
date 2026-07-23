/**
 * Reads the user's ledger settings from `proj_ledger_settings` (EP-1 read
 * model). EP-3.2 needs the IANA timezone to resolve day boundaries.
 */
export abstract class LedgerSettingsReader {
  abstract timezoneOf(userId: string): Promise<string>;
}
