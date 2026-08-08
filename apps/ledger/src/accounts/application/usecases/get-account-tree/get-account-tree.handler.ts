import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, OrderType } from '@shared';
import {
  AccountRow,
  AccountView,
  PROJ_ACCOUNTS,
  toAccountView,
} from '@ledger/accounts/application/read-models/account-tree.read-model';
import { GetAccountTreeQuery } from './get-account-tree.query';

/** Serves the user's account tree from `account_tree`, ordered by name (INV-9). */
export class GetAccountTreeHandler extends QueryHandler<GetAccountTreeQuery> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    _query: GetAccountTreeQuery,
    ctx: QueryContext,
  ): Promise<readonly AccountView[]> {
    const rows = await this.readModel.query<AccountRow>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', ctx.userId).orderBy('name', OrderType.ASC),
    );

    return rows.map(toAccountView);
  }
}
