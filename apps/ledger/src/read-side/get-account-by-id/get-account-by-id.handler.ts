import { Criteria, Nullable } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@ledger/shared-kernel/application/query-bus/query-handler';
import { GetAccountByIdQuery } from './get-account-by-id.query';

type AccountRow = { readonly account_id: string; readonly user_id: string; readonly name: string };

/** Serves one account node from `proj_accounts`, scoped to the user (INV-9). */
export class GetAccountByIdHandler extends QueryHandler<
  GetAccountByIdQuery,
  Nullable<AccountRow>
> {
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
