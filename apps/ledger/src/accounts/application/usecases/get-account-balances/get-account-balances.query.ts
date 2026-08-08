import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { BalanceView } from '@ledger/transactions/application/read-models/account-balances.read-model';

/** Returns balances per account and currency, optionally narrowed to one of each. */
export class GetAccountBalancesQuery extends Query<readonly BalanceView[]> {
  readonly queryType = 'GetAccountBalances';

  constructor(
    readonly accountId: Nullable<string> = null,
    readonly currency: Nullable<string> = null,
  ) {
    super();
  }
}
