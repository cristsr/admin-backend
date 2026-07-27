import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventPayload } from '@cqrs/domain/event/event-payload.type';

/** Event type name, exported so registry and projector never drift on a literal. */
export const CURRENCY_REGISTERED = 'CurrencyRegistered';

/** A currency joined the reference catalog with its decimal precision (RF-21). */
export class CurrencyRegistered extends DomainEvent {
  readonly eventType = CURRENCY_REGISTERED;
  readonly schemaVersion = 1;

  constructor(
    readonly code: string,
    readonly minorUnits: number,
    readonly name: string,
  ) {
    super();
  }

  static fromPayload(payload: EventPayload): CurrencyRegistered {
    return new CurrencyRegistered(
      payload.code as string,
      payload.minorUnits as number,
      payload.name as string,
    );
  }

  toPayload(): EventPayload {
    return { code: this.code, minorUnits: this.minorUnits, name: this.name };
  }
}
