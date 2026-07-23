import { Nullable } from '@shared';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { AggregateRoot } from '@ledger/shared-kernel/domain/aggregate/aggregate-root';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { AppendResult } from '@ledger/shared-kernel/domain/event/append-result.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';

/**
 * Reconstructs an aggregate from its stream and persists its uncommitted
 * changes atomically under optimistic concurrency (INV-7). Subclasses supply
 * the aggregate type and a `rehydrate` that folds deserialized events into an
 * instance.
 */
export abstract class EventSourcedRepository<TAggregate extends AggregateRoot<string>> {
  protected abstract readonly aggregateType: string;

  protected constructor(
    protected readonly eventStore: EventStore,
    protected readonly registry: EventRegistry,
    protected readonly envelopes: EnvelopeFactory,
  ) {}

  /** Rebuilds an aggregate from its ordered domain events. */
  protected abstract rehydrate(id: string, events: readonly DomainEvent[]): TAggregate;

  /** Loads and rehydrates the aggregate, or `null` when its stream is empty. */
  async load(userId: string, aggregateId: string): Promise<Nullable<TAggregate>> {
    const stored = await this.eventStore.load(this.streamId(userId, aggregateId));

    if (!stored.length) return null;

    const events = stored.map((event) =>
      this.registry.deserialize(event.eventType, event.schemaVersion, event.payload),
    );

    return this.rehydrate(aggregateId, events);
  }

  /** Appends the aggregate's uncommitted changes; a no-op when there are none. */
  async save(aggregate: TAggregate, ctx: AuthContext): Promise<AppendResult> {
    const changes = aggregate.pullChanges();
    const stream = this.streamId(ctx.userId, aggregate.id);

    const envelopes = this.envelopes.build(stream, aggregate.version, changes, ctx);

    return this.eventStore.append(stream, aggregate.version, envelopes);
  }

  private streamId(userId: string, aggregateId: string): StreamId {
    return { userId, aggregateType: this.aggregateType, aggregateId };
  }
}
