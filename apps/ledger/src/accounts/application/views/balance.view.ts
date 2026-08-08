/**
 * One account balance as the API exposes it, and the contract of the balance
 * read port. The owning user is absent: scope is context, never content (INV-9).
 */
export type BalanceView = {
  readonly accountId: string;
  readonly currency: string;
  /** Balance from confirmed transactions, as an exact decimal string (INV-8). */
  readonly confirmed: string;
  /** Delta contributed by still-pending transactions. */
  readonly pending: string;
};
