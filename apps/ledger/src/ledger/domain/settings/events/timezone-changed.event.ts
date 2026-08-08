import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/** The time zone that resolves the ledger's day boundaries was changed. */
export class TimezoneChanged extends DomainEvent {
  readonly eventType = 'TimezoneChanged';
  readonly schemaVersion = 1;

  constructor(
    readonly userId: string,
    readonly timezone: string,
  ) {
    super();
  }

  static fromPayload(payload: EventPayload): TimezoneChanged {
    return new TimezoneChanged(payload.userId as string, payload.timezone as string);
  }

  toPayload(): EventPayload {
    return {
      userId: this.userId,
      timezone: this.timezone,
    };
  }
}
