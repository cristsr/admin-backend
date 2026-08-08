import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { AssertionStatusStore } from '@ledger/reconciliation/application/ports/assertion-status-store.port';
import {
  AssertionStatusView,
  toAssertionStatusView,
} from '@ledger/reconciliation/application/read-models/assertion-status.read-model';
import { ListAssertionsQuery } from './list-assertions.query';

/** Serves every assertion on one account, scoped to the user (INV-9). */
export class ListAssertionsHandler extends QueryHandler<ListAssertionsQuery> {
  constructor(private readonly store: AssertionStatusStore) {
    super();
  }

  async execute(
    query: ListAssertionsQuery,
    ctx: QueryContext,
  ): Promise<readonly AssertionStatusView[]> {
    const rows = await this.store.listByAccount(ctx.userId, query.accountId);

    return rows.map(toAssertionStatusView);
  }
}
