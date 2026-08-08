import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { AccountBalanceFinder } from '@ledger/accounts/application/ports/account-balance-finder.port';
import { BalanceView } from '@ledger/accounts/application/views/balance.view';
import { GetAccountBalancesQuery } from './get-account-balances.query';

/**
 * Serves the user's balances (INV-9), optionally narrowed to one account or one
 * currency.
 *
 * The scope no longer has to be reconstructed here: balances carry their owner,
 * so the port answers with what belongs to the user instead of handing over
 * everyone's rows for this handler to sift through.
 */
export class GetAccountBalancesHandler extends QueryHandler<GetAccountBalancesQuery> {
  constructor(private readonly balances: AccountBalanceFinder) {
    super();
  }

  execute(query: GetAccountBalancesQuery, ctx: QueryContext): Promise<readonly BalanceView[]> {
    return this.balances.byUser(ctx.userId, {
      accountId: query.accountId ?? null,
      currency: query.currency ?? null,
    });
  }
}
