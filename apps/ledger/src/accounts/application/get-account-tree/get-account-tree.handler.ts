import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, OrderType } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { AccountTreeRow, GetAccountTreeQuery } from './get-account-tree.query';

/** Serves the user's account tree from `account_tree`, ordered by name (INV-9). */
export class GetAccountTreeHandler extends QueryHandler<GetAccountTreeQuery> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    _query: GetAccountTreeQuery,
    ctx: QueryContext,
  ): Promise<readonly AccountTreeRow[]> {
    return this.readModel.query<AccountTreeRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', ctx.userId).orderBy('name', OrderType.ASC),
    );
  }
}
