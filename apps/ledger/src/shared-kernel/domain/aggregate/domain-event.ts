import { Nullable } from '@shared';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';

/**
 * A domain fact emitted by an aggregate. It carries no envelope metadata
 * (`event_id`, `sequence`, timestamps) — the application layer adds that at
 * append time. `schemaVersion` drives upcasting on read (RNF-6); `toPayload`
 * yields a plain JSON object with every amount serialized as a decimal string
 * (RNF-2), never a float (INV-8).
 */
export abstract class DomainEvent {
  /** Stable discriminator, e.g. `'TransactionRecorded'`. */
  abstract readonly eventType: string;

  /** Payload schema version; starts at 1 and bumps on breaking changes. */
  abstract readonly schemaVersion: number;

  /** Serializes the event body to a JSON-safe payload. */
  abstract toPayload(): EventPayload;

  /**
   * When the fact happened in the real world, when that differs from when the
   * ledger heard about it — a bank notification timestamp, say. The envelope's
   * `occurred_at` takes this; `recorded_at` always stays the append instant
   * (§3.4). Null means the two coincide, which is the common case: a fact the
   * ledger itself produces happens as it is recorded.
   *
   * This is what makes intraday assertions evaluable (§2.4): without it every
   * posting looks like it happened the moment its command ran.
   */
  occurredAt(): Nullable<Date> {
    return null;
  }
}
