import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';
import { PendingReviewView } from '@ledger/transactions/application/views/pending-review.view';

/** Page size applied when the caller does not ask for one, so reads stay bounded. */
export const DEFAULT_PENDING_REVIEW_PAGE_SIZE = 50;

/** The review inbox is a single list per user; only paging narrows it. */
export class ListPendingReviewQuery extends Query<readonly PendingReviewView[]> {
  readonly queryType = 'ListPendingReview';

  constructor(
    readonly limit: Nullable<number> = null,
    readonly offset: Nullable<number> = null,
  ) {
    super();
  }
}
