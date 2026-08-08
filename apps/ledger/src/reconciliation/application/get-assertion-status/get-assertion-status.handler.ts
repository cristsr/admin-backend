import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import {
  AssertionStatusView,
  toAssertionStatusView,
} from '@ledger/reconciliation/application/read-models/assertion-status.read-model';
import { AssertionStatusStore } from '@ledger/reconciliation/domain/ports/assertion-status-store.port';
import { GetAssertionStatusQuery } from './get-assertion-status.query';

/** Serves one assertion from `proj_assertions`, scoped to the user (INV-9). */
export class GetAssertionStatusHandler extends QueryHandler<GetAssertionStatusQuery> {
  constructor(private readonly store: AssertionStatusStore) {
    super();
  }

  async execute(
    query: GetAssertionStatusQuery,
    ctx: QueryContext,
  ): Promise<Nullable<AssertionStatusView>> {
    const row = await this.store.byId(ctx.userId, query.assertionId);

    return row ? toAssertionStatusView(row) : null;
  }
}
