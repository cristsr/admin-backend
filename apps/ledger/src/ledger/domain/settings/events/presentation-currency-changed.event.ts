import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/** The currency every balance is reported in was changed. */
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
