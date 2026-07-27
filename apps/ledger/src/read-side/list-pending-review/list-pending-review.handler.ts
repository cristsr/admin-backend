import { Criteria, Nullable, OrderType } from '@shared';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@ledger/shared-kernel/application/query-bus/query-handler';
import { PROJ_PENDING_REVIEW } from '@ledger/transactions/infrastructure/projections/pending-review.projector';
import {
  DEFAULT_PENDING_REVIEW_PAGE_SIZE,
  ListPendingReviewQuery,
} from './list-pending-review.query';

export type PendingReviewRow = {
  readonly transaction_id: string;
  readonly date: string;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly posting_count: number;
  readonly client_id: string;
  readonly external_ref: Nullable<string>;
};

/**
 * Serves the review inbox from `pending_review` (§3.6), scoped to the user
 * (INV-9). Oldest first: the inbox is a work queue, so what has been waiting
 * longest comes up first — the opposite of the transaction list, which reads as
 * history and leads with the most recent.
 */
export class ListPendingReviewHandler extends QueryHandler<
  ListPendingReviewQuery,
  readonly PendingReviewRow[]
> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  execute(
    query: ListPendingReviewQuery,
    ctx: QueryContext,
  ): Promise<readonly PendingReviewRow[]> {
    const criteria = Criteria.none()
      .equals('user_id', ctx.userId)
      .orderBy('date', OrderType.ASC)
      .paginate({
        offset: query.offset ?? 0,
        limit: query.limit ?? DEFAULT_PENDING_REVIEW_PAGE_SIZE,
      });

    return this.readModel.query<PendingReviewRow>(PROJ_PENDING_REVIEW, criteria);
  }
}
