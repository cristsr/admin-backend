/**
 * Query to retrieve the user's ledger settings.
 */
export class GetLedgerSettingsQuery {
  constructor(readonly userId: string) {}
}
