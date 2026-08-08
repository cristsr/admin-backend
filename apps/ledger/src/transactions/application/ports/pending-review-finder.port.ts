import { PageRequest } from '@ledger/transactions/application/ports/page-request.type';
import { PendingReviewView } from '@ledger/transactions/application/views/pending-review.view';

export type { PageRequest };

/**
 * Read port over the pending review projection, serving the review inbox.
 *
 * Oldest first: the inbox is a work queue, so what has been waiting longest
 * comes up first — the opposite of the transaction list, which reads as
 * history and leads with the most recent.
 *
 * Writes are deliberately absent: `PendingReviewProjector` is the only writer
 * and it goes through the shared `ReadModelStore` (rules Art. 10).
 */
export abstract class PendingReviewFinder {
  abstract list(userId: string, page: PageRequest): Promise<readonly PendingReviewView[]>;
}
