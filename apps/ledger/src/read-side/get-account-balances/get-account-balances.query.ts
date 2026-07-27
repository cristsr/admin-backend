import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';

/** Returns balances per account and currency, optionally for one account (RF-13). */
export class GetAccountBalancesQuery extends Query {
  readonly queryType = 'GetAccountBalances';

  constructor(readonly accountId: Nullable<string> = null) {
    super();
  }
}
