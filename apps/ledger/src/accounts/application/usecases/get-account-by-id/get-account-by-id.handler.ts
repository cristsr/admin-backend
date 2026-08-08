import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import { AccountTreeFinder } from '@ledger/accounts/application/ports/account-tree-finder.port';
import { AccountView } from '@ledger/accounts/application/views/account.view';
import { GetAccountByIdQuery } from './get-account-by-id.query';

/** Serves one account node, scoped to the user (INV-9). */
export class GetAccountByIdHandler extends QueryHandler<GetAccountByIdQuery> {
  constructor(private readonly accounts: AccountTreeFinder) {
    super();
  }

  execute(query: GetAccountByIdQuery, ctx: QueryContext): Promise<Nullable<AccountView>> {
    return this.accounts.byId(ctx.userId, query.accountId);
  }
}
