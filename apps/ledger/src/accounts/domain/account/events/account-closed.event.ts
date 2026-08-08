import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/** An account was closed on a given accounting date. */
export class AccountClosed extends DomainEvent {
  readonly eventType = 'AccountClosed';
  readonly schemaVersion = 1;

  constructor(readonly closedOn: string) {
    super();
  }

  static fromPayload(payload: EventPayload): AccountClosed {
    return new AccountClosed(payload.closedOn as string);
  }

  toPayload(): EventPayload {
    return { closedOn: this.closedOn };
  }
}
