import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';

/** Page size applied when the caller does not ask for one, so reads stay bounded. */
export const DEFAULT_PENDING_REVIEW_PAGE_SIZE = 50;

/** The review inbox is a single list per user; only paging narrows it (§3.6). */
export class ListPendingReviewQuery extends Query {
  readonly queryType = 'ListPendingReview';

  constructor(
    readonly limit: Nullable<number> = null,
    readonly offset: Nullable<number> = null,
  ) {
    super();
  }
}
