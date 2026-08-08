/**
 * Resolves the id of a user's technical account by canonical role (INV-13).
 *
 * The two roles answer the write side's needs: adjustments are booked by
 * reconciliation, opening balances by `accounts`. Both ids are internal
 * details of how those entries are booked — nothing a client may post against
 * directly, which is why they never reach the API view (INV-13).
 */
export abstract class SystemAccountLookup {
  /** The user's `Equity:Adjustments` account id, created at InitializeLedger. */
  abstract adjustmentsAccountId(userId: string): Promise<string>;

  /** The user's `Equity:OpeningBalances` account id, created at InitializeLedger. */
  abstract openingBalancesAccountId(userId: string): Promise<string>;
}
