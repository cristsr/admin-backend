import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';

/** An account was closed on a given accounting date (§3.4). */
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
