import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/**
 * A CONFIRMED transaction was reversed, pointing to the system-created
 * reversing transaction that offsets it (§3.4, RF-7).
 */
export class TransactionReversed extends DomainEvent {
  readonly eventType = 'TransactionReversed';
  readonly schemaVersion = 1;

  constructor(readonly reversalTransactionId: string) {
    super();
  }

  static fromPayload(payload: EventPayload): TransactionReversed {
    return new TransactionReversed(payload.reversalTransactionId as string);
  }

  toPayload(): EventPayload {
    return { reversalTransactionId: this.reversalTransactionId };
  }
}
