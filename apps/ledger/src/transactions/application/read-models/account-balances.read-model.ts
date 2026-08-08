/** Read-model table for balances per account and currency. */
export const PROJ_BALANCES = 'proj_balances';

/** One row of `proj_balances`, exactly as stored. Amounts stay decimal strings (INV-8). */
export type BalanceRow = {
  readonly account_id: string;
  readonly currency_code: string;
  readonly confirmed_amount: string;
  readonly pending_amount: string;
};

/** One balance as the API exposes it. */
export type BalanceView = {
  readonly accountId: string;
  readonly currency: string;
  /** Balance from confirmed transactions, as an exact decimal string (INV-8). */
  readonly confirmed: string;
  /** Delta contributed by still-pending transactions. */
  readonly pending: string;
};

/** Maps a stored row to what goes over the wire. */
export function toBalanceView(row: BalanceRow): BalanceView {
  return {
    accountId: row.account_id,
    currency: row.currency_code,
    confirmed: row.confirmed_amount,
    pending: row.pending_amount,
  };
}
