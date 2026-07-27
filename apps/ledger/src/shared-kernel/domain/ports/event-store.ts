import { Nullable } from '@shared';
import { AppendResult } from '@ledger/shared-kernel/domain/event/append-result.type';
import { EventEnvelope } from '@ledger/shared-kernel/domain/event/event-envelope.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';

/**
 * Append-only event store (INV-12) — the ledger's source of truth. Its contract
 * is verified by one reusable suite that runs identically against the in-memory
 * double and the PostgreSQL adapter (RNF-11).
 *
 * Concurrency (INV-7): `expectedVersion` is the sequence the caller believes is
 * the current head — 0 for a new stream. A mismatch throws
 * {@link ConcurrencyConflictException} and persists nothing (atomic append).
 *
 * Idempotency (INV-10): `external_ref` is stamped on a command's anchor event
 * only. Appending a batch whose anchor `external_ref` already exists for the
 * user throws {@link DuplicateExternalRefException}; the primary idempotency
 * check runs in the bus via {@link findByExternalRef}, the unique index being
 * defense-in-depth (RNF-1).
 */
export abstract class EventStore {
  /** Atomically appends a batch to one stream under optimistic concurrency. */
  abstract append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult>;

  /** Full history of one aggregate ordered by sequence; `[]` when unknown. */
  abstract load(stream: StreamId): Promise<readonly StoredEvent[]>;

  /** Global-position-ordered slice for projection catch-up. */
  abstract readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>;

  /**
   * Runs `work` so that every `append` inside it commits or rolls back together
   * (cross-stream atomicity).
   *
   * A command touching several aggregates — merging two pendings into a
   * transfer, closing a discrepancy with an adjustment — writes to more than one
   * stream. Without this, a process dying between appends leaves a pending
   * voided with nothing replacing it: visible data loss, not a recoverable
   * intermediate state.
   *
   * Optimistic concurrency still applies per stream (INV-7): a conflict on any
   * of them aborts the whole scope. Nesting is not supported — an inner call
   * joins the outer scope rather than opening a second transaction.
   */
  abstract withTransaction<T>(work: () => Promise<T>): Promise<T>;

  /** The anchor event of the command that used this `external_ref`, if any. */
  abstract findByExternalRef(
    userId: string,
    externalRef: string,
  ): Promise<Nullable<StoredEvent>>;
}
