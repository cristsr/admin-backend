import { Nullable } from '@shared';
import { EventPayload } from './event-payload.type';

/**
 * A domain event wrapped with its append-time metadata. Immutable; the
 * base for auditability (INV-3) and idempotency (INV-10). `sequence` is
 * the 1-based version within the aggregate; `externalRef` is stamped only on a
 * command's anchor event (roadmap: anchor-only stamping).
 */
export type EventEnvelope = {
  readonly eventId: string;
  readonly userId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
  readonly payload: EventPayload;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
};
