import { DomainUnprocessableException } from '@shared';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';

/** Rebuilds a typed event from a stored payload, upcasting older versions. */
export type EventDeserializer = (schemaVersion: number, payload: EventPayload) => DomainEvent;

/** No deserializer is registered for a stored `event_type`. */
export class UnknownEventTypeException extends DomainUnprocessableException {
  readonly code: string = 'UNKNOWN_EVENT_TYPE';
}

/**
 * Central map from `event_type` to its deserializer (RNF-6). Upcasting of old
 * `schema_version`s happens inside the registered deserializer; events are
 * never migrated in place.
 */
export abstract class EventRegistry {
  abstract register(eventType: string, deserializer: EventDeserializer): void;

  abstract deserialize(
    eventType: string,
    schemaVersion: number,
    payload: EventPayload,
  ): DomainEvent;
}

/** In-process registry backed by a plain map. Pure; no infrastructure. */
export class DomainEventRegistry extends EventRegistry {
  private readonly deserializers = new Map<string, EventDeserializer>();

  register(eventType: string, deserializer: EventDeserializer): void {
    this.deserializers.set(eventType, deserializer);
  }

  deserialize(eventType: string, schemaVersion: number, payload: EventPayload): DomainEvent {
    const deserializer = this.deserializers.get(eventType);

    if (!deserializer) {
      throw new UnknownEventTypeException(`No deserializer registered for "${eventType}"`);
    }

    return deserializer(schemaVersion, payload);
  }
}
