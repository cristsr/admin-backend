/**
 * Reads the user's IANA timezone from `proj_ledger_settings`.
 *
 * Named after what it answers rather than after the row it reads: the previous
 * `LedgerSettingsReader` promised the settings and delivered one field.
 */
export abstract class LedgerTimezoneReader {
  abstract timezoneOf(userId: string): Promise<string>;
}
