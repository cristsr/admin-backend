import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';

/**
 * An account was renamed. The prefix propagation to descendants happens in the
 * `account_tree` projection (§6.3), not on the stream.
 */
export class AccountRenamed extends DomainEvent {
  readonly eventType = 'AccountRenamed';
  readonly schemaVersion = 1;

  constructor(
    readonly previousName: string,
    readonly newName: string,
  ) {
    super();
  }

  static fromPayload(payload: EventPayload): AccountRenamed {
    return new AccountRenamed(payload.previousName as string, payload.newName as string);
  }

  toPayload(): EventPayload {
    return { previousName: this.previousName, newName: this.newName };
  }
}
