import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { EventRegistry } from '@cqrs/application/event/event-registry';
import { AggregateRoot } from '@cqrs/domain/aggregate/aggregate-root';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { EventSourcedRepository } from './event-sourced.repository';

class TestAggregate extends AggregateRoot<string> {
  constructor(id: string) {
    super(id);
  }

  apply(_event: DomainEvent): void {}

  raise(event: DomainEvent): void {
    super.raise(event);
  }
}

class TestRepository extends EventSourcedRepository<TestAggregate> {
  readonly aggregateType = 'Test';

  constructor(
    eventStore: EventStore,
    registry: EventRegistry,
    envelopes: EnvelopeFactory,
  ) {
    super(eventStore, registry, envelopes);
  }

  rehydrate(_id: string, _events: readonly DomainEvent[]): TestAggregate {
    return new TestAggregate('test-id');
  }
}

describe('EventSourcedRepository', () => {
  let repo: TestRepository;
  let mockStore: jest.Mocked<EventStore>;
  let mockRegistry: jest.Mocked<EventRegistry>;
  let mockEnvelopes: jest.Mocked<EnvelopeFactory>;

  beforeEach(() => {
    mockStore = {
      append: jest.fn(),
      load: jest.fn(),
      readAll: jest.fn(),
      findByExternalRef: jest.fn(),
    } as unknown as jest.Mocked<EventStore>;

    mockRegistry = { register: jest.fn(), deserialize: jest.fn() } as unknown as jest.Mocked<EventRegistry>;
    mockEnvelopes = { build: jest.fn() } as unknown as jest.Mocked<EnvelopeFactory>;

    repo = new TestRepository(mockStore, mockRegistry, mockEnvelopes);
  });

  describe('save', () => {
    it('returns early without calling append when aggregate has no uncommitted changes', async () => {
      const aggregate = new TestAggregate('agg-1');
      const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: null };

      const result = await repo.save(aggregate, ctx);

      expect(mockStore.append).not.toHaveBeenCalled();
      expect(mockEnvelopes.build).not.toHaveBeenCalled();
      expect(result).toEqual({ events: [], version: 0, lastPosition: 0n });
    });

    it('calls append when aggregate has uncommitted changes', async () => {
      const aggregate = new TestAggregate('agg-1');
      const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: null };
      const mockEvent = { eventType: 'X', schemaVersion: 1, toPayload: () => ({}) } as DomainEvent;
      aggregate.raise(mockEvent);

      const envelopes = [{ eventId: 'a', userId: 'u', aggregateType: 'Test', aggregateId: 'agg-1', sequence: 1, eventType: 'X', schemaVersion: 1, clientId: 'c', externalRef: null, payload: {}, occurredAt: new Date(), recordedAt: new Date() }];
      mockEnvelopes.build.mockReturnValue(envelopes);
      mockStore.append.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

      await repo.save(aggregate, ctx);

      expect(mockEnvelopes.build).toHaveBeenCalled();
      expect(mockStore.append).toHaveBeenCalled();
    });
  });
});
