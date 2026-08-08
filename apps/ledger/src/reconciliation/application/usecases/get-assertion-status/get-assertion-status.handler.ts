import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Nullable } from '@shared';
import { AssertionStatusReader } from '@ledger/reconciliation/application/ports/assertion-status-reader.port';
import {
  AssertionStatusView,
  toAssertionStatusView,
} from '@ledger/reconciliation/application/views/assertion-status.view';
import { GetAssertionStatusQuery } from './get-assertion-status.query';

/** Serves one assertion from `proj_assertions`, scoped to the user (INV-9). */
export class GetAssertionStatusHandler extends QueryHandler<GetAssertionStatusQuery> {
  constructor(private readonly store: AssertionStatusReader) {
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
