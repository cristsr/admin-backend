/** Resolves the id of a user's technical account by canonical role (INV-13). */
export abstract class SystemAccountLookup {
  /** The user's `Equity:Adjustments` account id, created at InitializeLedger. */
  abstract adjustmentsAccountId(userId: string): Promise<string>;
}
