import { Query } from '@cqrs/application/query-bus/query';
import { Nullable } from '@shared';

/** Page size applied when the caller does not ask for one, so reads stay bounded. */
export const DEFAULT_PENDING_REVIEW_PAGE_SIZE = 50;

/** One row of the review inbox as `pending_review` stores it. */
export type PendingReviewRow = {
  readonly transaction_id: string;
  readonly date: string;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly posting_count: number;
  readonly client_id: string;
  readonly external_ref: Nullable<string>;
};

/** The review inbox is a single list per user; only paging narrows it. */
export class ListPendingReviewQuery extends Query<readonly PendingReviewRow[]> {
  readonly queryType = 'ListPendingReview';

  constructor(
    readonly limit: Nullable<number> = null,
    readonly offset: Nullable<number> = null,
  ) {
    super();
  }
}
