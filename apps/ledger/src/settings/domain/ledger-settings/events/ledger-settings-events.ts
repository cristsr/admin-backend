import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/**
 * Raised when the presentation currency is changed.
 */
export class PresentationCurrencyChanged extends DomainEvent {
  readonly eventType = 'PresentationCurrencyChanged';
  readonly schemaVersion = 1;

  constructor(
    readonly userId: string,
    readonly presentationCurrency: string,
  ) {
    super();
  }

  static fromPayload(payload: EventPayload): PresentationCurrencyChanged {
    return new PresentationCurrencyChanged(
      payload.userId as string,
      payload.presentationCurrency as string,
    );
  }

  toPayload(): EventPayload {
    return {
      userId: this.userId,
      presentationCurrency: this.presentationCurrency,
    };
  }
}

/**
 * Raised when the timezone is changed.
 */
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
    return new TimezoneChanged(
      payload.userId as string,
      payload.timezone as string,
    );
  }

  toPayload(): EventPayload {
    return {
      userId: this.userId,
      timezone: this.timezone,
    };
  }
}
