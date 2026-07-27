import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/** Stable event-type name for a revocation (spec §3.4). */
export const ASSERTION_REVOKED = 'AssertionRevoked';

/** An assertion was revoked; the reason is audited in the stream. */
export class AssertionRevoked extends DomainEvent {
  readonly eventType = ASSERTION_REVOKED;
  readonly schemaVersion = 1;

  constructor(readonly reason: string) {
    super();
  }

  static fromPayload(payload: EventPayload): AssertionRevoked {
    return new AssertionRevoked(payload.reason as string);
  }

  toPayload(): EventPayload {
    return { reason: this.reason };
  }
}
