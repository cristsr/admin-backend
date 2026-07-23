import { Criteria, OrderType } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@ledger/shared-kernel/application/query-bus/query-handler';
import { GetAccountTreeQuery } from './get-account-tree.query';

type AccountRow = { readonly account_id: string; readonly name: string };

/** Serves the user's account tree from `account_tree`, ordered by name (INV-9). */
export class GetAccountTreeHandler extends QueryHandler<
  GetAccountTreeQuery,
  readonly AccountRow[]
> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(_query: GetAccountTreeQuery, ctx: QueryContext): Promise<readonly AccountRow[]> {
    return this.readModel.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', ctx.userId).orderBy('name', OrderType.ASC),
    );
  }
}
