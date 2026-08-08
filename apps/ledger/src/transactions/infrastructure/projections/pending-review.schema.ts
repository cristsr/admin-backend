import { Nullable } from '@shared';
import { PendingReviewView } from '@ledger/transactions/application/views/pending-review.view';

/**
 * Physical shape of `proj_pending_review`, declared next to the projector that
 * writes it. `PendingReviewProjector` remains its only writer (rules Art. 10).
 */
export const PROJ_PENDING_REVIEW = 'proj_pending_review';

/** One row of `proj_pending_review`, exactly as stored. */
export type PendingReviewRow = {
  readonly transaction_id: string;
  readonly user_id: string;
  readonly date: string;
  readonly occurred_at: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly posting_count: number;
  readonly client_id: string;
  readonly external_ref: Nullable<string>;
};

/** Maps a stored row to what goes over the wire. */
export function toPendingReviewView(row: PendingReviewRow): PendingReviewView {
  return {
    id: row.transaction_id,
    date: row.date,
    occurredAt: row.occurred_at ?? null,
    payee: row.payee ?? null,
    description: row.description,
    postingCount: Number(row.posting_count),
    clientId: row.client_id,
    externalRef: row.external_ref ?? null,
  };
}
