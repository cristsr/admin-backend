import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';

/** A PENDING transaction was confirmed, freezing its postings (§3.4). */
export class TransactionConfirmed extends DomainEvent {
  readonly eventType = 'TransactionConfirmed';
  readonly schemaVersion = 1;

  constructor(readonly confirmedAt: string) {
    super();
  }

  static fromPayload(payload: EventPayload): TransactionConfirmed {
    return new TransactionConfirmed(payload.confirmedAt as string);
  }

  toPayload(): EventPayload {
    return { confirmedAt: this.confirmedAt };
  }
}
