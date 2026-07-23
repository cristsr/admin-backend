import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { DomainEventRegistry, UnknownEventTypeException } from './event-registry';

class Renamed extends DomainEvent {
  readonly eventType = 'Renamed';
  readonly schemaVersion = 2;

  constructor(readonly name: string) {
    super();
  }

  toPayload(): EventPayload {
    return { name: this.name };
  }
}

describe('DomainEventRegistry', () => {
  it('deserializes by event type', () => {
    const registry = new DomainEventRegistry();
    registry.register('Renamed', (_v, payload) => new Renamed(payload.name as string));

    const event = registry.deserialize('Renamed', 2, { name: 'Assets:Bank' });

    expect(event).toBeInstanceOf(Renamed);
    expect((event as Renamed).name).toBe('Assets:Bank');
  });

  it('upcasts an older schema version inside the deserializer', () => {
    const registry = new DomainEventRegistry();
    registry.register('Renamed', (version, payload) => {
      // v1 stored the field as `label`; v2 renamed it to `name`.
      const name = version < 2 ? (payload.label as string) : (payload.name as string);

      return new Renamed(name);
    });

    const upcasted = registry.deserialize('Renamed', 1, { label: 'Assets:Old' });

    expect((upcasted as Renamed).name).toBe('Assets:Old');
  });

  it('throws for an unknown event type', () => {
    const registry = new DomainEventRegistry();

    expect(() => registry.deserialize('Nope', 1, {})).toThrow(UnknownEventTypeException);
  });
});
