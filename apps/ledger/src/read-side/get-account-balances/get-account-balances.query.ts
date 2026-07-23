import { Nullable } from '@shared';
import { Query } from '@ledger/shared-kernel/application/query-bus/query';

/** Returns balances per account and currency, optionally for one account (RF-13). */
export class GetAccountBalancesQuery extends Query {
  readonly queryType = 'GetAccountBalances';

  constructor(readonly accountId: Nullable<string> = null) {
    super();
  }
}
