import {
  QueryContext,
  QueryHandler,
} from '@cqrs/application/query-bus/query-handler';
import { PendingReviewFinder } from '@ledger/transactions/application/ports/pending-review-finder.port';
import { PendingReviewView } from '@ledger/transactions/application/views/pending-review.view';
import {
  DEFAULT_PENDING_REVIEW_PAGE_SIZE,
  ListPendingReviewQuery,
} from './list-pending-review.query';

/**
 * Serves the review inbox through the finder, scoped to the user (INV-9).
 *
 * Oldest first: the inbox is a work queue, so what has been waiting longest
 * comes up first — the opposite of the transaction list, which reads as
 * history and leads with the most recent.
 */
export class ListPendingReviewHandler extends QueryHandler<ListPendingReviewQuery> {
  constructor(private readonly inbox: PendingReviewFinder) {
    super();
  }

  async execute(
    query: ListPendingReviewQuery,
    ctx: QueryContext,
  ): Promise<readonly PendingReviewView[]> {
    return this.inbox.list(ctx.userId, {
      offset: query.offset ?? 0,
      limit: query.limit ?? DEFAULT_PENDING_REVIEW_PAGE_SIZE,
    });
  }
}
