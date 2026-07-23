import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';

/** A PENDING transaction was voided with a reason (§3.4, RF-8). */
export class TransactionVoided extends DomainEvent {
  readonly eventType = 'TransactionVoided';
  readonly schemaVersion = 1;

  constructor(readonly reason: string) {
    super();
  }

  static fromPayload(payload: EventPayload): TransactionVoided {
    return new TransactionVoided(payload.reason as string);
  }

  toPayload(): EventPayload {
    return { reason: this.reason };
  }
}
