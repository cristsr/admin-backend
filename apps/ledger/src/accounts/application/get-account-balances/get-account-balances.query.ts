import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';

/** One balance row as `proj_balances` stores it: amounts stay decimal strings. */
export type BalanceRow = {
  readonly account_id: string;
  readonly currency_code: string;
  readonly confirmed_amount: string;
  readonly pending_amount: string;
};

/** Returns balances per account and currency, optionally for one account. */
export class GetAccountBalancesQuery extends Query<readonly BalanceRow[]> {
  readonly queryType = 'GetAccountBalances';

  constructor(readonly accountId: Nullable<string> = null) {
    super();
  }
}
