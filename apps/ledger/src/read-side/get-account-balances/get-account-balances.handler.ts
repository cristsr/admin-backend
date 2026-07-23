import { Criteria } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@ledger/shared-kernel/application/query-bus/query-handler';
import { PROJ_BALANCES } from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import { GetAccountBalancesQuery } from './get-account-balances.query';

type BalanceRow = {
  readonly account_id: string;
  readonly currency_code: string;
  readonly confirmed_amount: string;
  readonly pending_amount: string;
};

/**
 * Serves balances from `proj_balances`, scoped to the user's own accounts
 * (INV-9) by intersecting with `account_tree`, since balances carry no user id.
 */
export class GetAccountBalancesHandler extends QueryHandler<
  GetAccountBalancesQuery,
  readonly BalanceRow[]
> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    query: GetAccountBalancesQuery,
    ctx: QueryContext,
  ): Promise<readonly BalanceRow[]> {
    const owned = await this.ownedAccountIds(ctx.userId);
    const balances = await this.readModel.query<BalanceRow>(PROJ_BALANCES, Criteria.none());

    return balances.filter(
      (balance) =>
        owned.has(balance.account_id) &&
        (!query.accountId || balance.account_id === query.accountId),
    );
  }

  private async ownedAccountIds(userId: string): Promise<Set<string>> {
    const accounts = await this.readModel.query<{ account_id: string }>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId),
    );

    return new Set(accounts.map((account) => account.account_id));
  }
}
