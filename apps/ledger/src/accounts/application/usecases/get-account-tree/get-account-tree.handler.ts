import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { AccountTreeFinder } from '@ledger/accounts/application/ports/account-tree-finder.port';
import { AccountView } from '@ledger/accounts/application/views/account.view';
import { GetAccountTreeQuery } from './get-account-tree.query';

/** Serves the user's account tree, ordered by name (INV-9). */
export class GetAccountTreeHandler extends QueryHandler<GetAccountTreeQuery> {
  constructor(private readonly accounts: AccountTreeFinder) {
    super();
  }

  execute(_query: GetAccountTreeQuery, ctx: QueryContext): Promise<readonly AccountView[]> {
    return this.accounts.tree(ctx.userId);
  }
}
