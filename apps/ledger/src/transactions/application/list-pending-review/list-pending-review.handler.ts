import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { Criteria, OrderType } from '@shared';
import {
  PROJ_PENDING_REVIEW,
  PendingReviewRow,
  PendingReviewView,
  toPendingReviewView,
} from '@ledger/transactions/application/read-models/pending-review.read-model';
import {
  DEFAULT_PENDING_REVIEW_PAGE_SIZE,
  ListPendingReviewQuery,
} from './list-pending-review.query';

/**
 * Serves the review inbox from `pending_review`, scoped to the user
 * (INV-9). Oldest first: the inbox is a work queue, so what has been waiting
 * longest comes up first — the opposite of the transaction list, which reads as
 * history and leads with the most recent.
 */
export class ListPendingReviewHandler extends QueryHandler<ListPendingReviewQuery> {
  constructor(private readonly readModel: ReadModelStore) {
    super();
  }

  async execute(
    query: ListPendingReviewQuery,
    ctx: QueryContext,
  ): Promise<readonly PendingReviewView[]> {
    const criteria = Criteria.none()
      .equals('user_id', ctx.userId)
      .orderBy('date', OrderType.ASC)
      .paginate({
        offset: query.offset ?? 0,
        limit: query.limit ?? DEFAULT_PENDING_REVIEW_PAGE_SIZE,
      });

    const rows = await this.readModel.query<PendingReviewRow>(PROJ_PENDING_REVIEW, criteria);

    return rows.map(toPendingReviewView);
  }
}
