/**
 * Physical shape of `proj_balances`, declared next to the projector that writes
 * it. `AccountBalancesProjector` remains its only writer (rules Art. 10).
 *
 * Written by `transactions` and queried by `accounts`, whose `GetAccountBalances`
 * use case exposes it. That asymmetry predates this file — the balances read
 * model always belonged to the module that folds postings, while the question
 * "what is this account worth?" belongs to the module that owns accounts. What
 * changed is that it is now confined to infrastructure: the `accounts` use case
 * talks to a port and never learns that a table called `proj_balances` exists.
 */
export const PROJ_BALANCES = 'proj_balances';

/**
 * One row of `proj_balances`, exactly as stored. Amounts stay decimal strings
 * (INV-8, rules Art. 7); `user_id` is part of the primary key.
 */
export type BalanceRow = {
  readonly user_id: string;
  readonly account_id: string;
  readonly currency_code: string;
  readonly confirmed_amount: string;
  readonly pending_amount: string;
};
