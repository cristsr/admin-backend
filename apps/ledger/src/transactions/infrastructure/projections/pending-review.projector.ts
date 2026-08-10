import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { Criteria, Nullable } from '@shared';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';
import { PostingPayload } from '@ledger/transactions/domain/posting/posting.serializer';
import { PROJ_PENDING_REVIEW } from '@ledger/transactions/infrastructure/projections/pending-review.schema';

type PendingReviewRow = {
  readonly transaction_id: string;
  readonly user_id: string;
  readonly date: string;
  readonly occurred_at: string;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly posting_count: number;
  readonly client_id: string;
  readonly external_ref: Nullable<string>;
};

/**
 * The frontend's review inbox (`pending_review`): one row per `PENDING`
 * transaction, removed the moment it is confirmed or voided.
 *
 * `transaction_list` filtered by `status=PENDING` answers the same question, but
 * this table only ever holds what is actually awaiting review while
 * `proj_transactions` grows for the life of the ledger — the inbox stays cheap
 * as history accumulates. It carries no postings on purpose: the inbox lists
 * what needs attention, and the detail view reads the transaction itself.
 */
export class PendingReviewProjector extends Projector {
  readonly name = 'pending_review';
  readonly consumes = [
    'TransactionRecorded',
    'TransactionAmended',
    'TransactionAnnotated',
    'TransactionConfirmed',
    'TransactionVoided',
  ];

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    // Confirming or voiding is what takes a transaction out of the inbox.
    if (event.eventType === 'TransactionConfirmed' || event.eventType === 'TransactionVoided') {
      return store.delete(PROJ_PENDING_REVIEW, { transaction_id: event.aggregateId });
    }

    if (event.eventType === 'TransactionRecorded') return this.onRecorded(event, payload, store);

    return this.onRevised(event, payload, store);
  }

  private async onRecorded(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    // A transaction recorded straight as CONFIRMED never enters the inbox.
    if (payload.status !== TransactionStatus.PENDING) return;

    const postings = (payload.postings as PostingPayload[]) ?? [];

    await store.upsert(
      PROJ_PENDING_REVIEW,
      { transaction_id: event.aggregateId },
      {
        transaction_id: event.aggregateId,
        user_id: event.userId,
        date: payload.date as string,
        occurred_at: event.occurredAt.toISOString(),
        payee: (payload.payee as Nullable<string>) ?? null,
        description: payload.description as string,
        posting_count: postings.length,
        client_id: event.clientId,
        external_ref: event.externalRef,
      } satisfies PendingReviewRow,
    );
  }

  /**
   * An amendment or annotation only refreshes a row that is already in the inbox
   * — annotation is legal on a CONFIRMED transaction too (INV-6), and that one
   * has no business reappearing here.
   */
  private async onRevised(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    const existing = await this.pending(event.aggregateId, store);

    if (!existing) return;

    const postings = payload.postings as Nullable<PostingPayload[]>;

    await store.upsert(
      PROJ_PENDING_REVIEW,
      { transaction_id: event.aggregateId },
      {
        ...existing,
        date: (payload.date as Nullable<string>) ?? existing.date,
        payee: (payload.payee as Nullable<string>) ?? existing.payee,
        description: (payload.description as Nullable<string>) ?? existing.description,
        posting_count: postings?.length ?? existing.posting_count,
      } satisfies PendingReviewRow,
    );
  }

  private async pending(
    transactionId: string,
    store: ReadModelStore,
  ): Promise<Nullable<PendingReviewRow>> {
    const [row] = await store.query<PendingReviewRow>(
      PROJ_PENDING_REVIEW,
      Criteria.none().equals('transaction_id', transactionId),
    );

    return row ?? null;
  }
}
