import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, Nullable } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { AccountRow, GetAccountByIdQuery } from './get-account-by-id.query';

/** Serves one account node from `proj_accounts`, scoped to the user (INV-9). */
export class GetAccountByIdHandler extends QueryHandler<GetAccountByIdQuery> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(query: GetAccountByIdQuery, ctx: QueryContext): Promise<Nullable<AccountRow>> {
    const [row] = await this.readModel.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', ctx.userId).equals('account_id', query.accountId),
    );

    return row ?? null;
  }
}
