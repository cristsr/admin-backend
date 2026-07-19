/** AC-5 (sm-0003) — result of archiving an account in cascade. */
export class AccountArchivedOutputDto {
  accountId: number;

  /** Movements of the account that were soft-deleted. */
  archivedMovements: number;

  /** Transfer groups whose both legs were soft-deleted. */
  archivedTransfers: number;
}
