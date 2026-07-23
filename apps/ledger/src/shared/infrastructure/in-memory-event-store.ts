import { Nullable } from '@shared';
import {
  CommandResult,
  DomainEvent,
  EventStore,
  LedgerConcurrencyException,
  PositionedEvent,
} from '@ledger/shared/ep1-ep2-contracts.assumed';

/**
 * In-memory double of the assumed EP-1 {@link EventStore}: append-only, global
 * ordering, optimistic concurrency and anchor `external_ref` idempotency. Lets
 * EP-3 wire full flows (repositories + projectors + reactor) without Postgres.
 */
export class InMemoryEventStore extends EventStore {
  private readonly byAggregate = new Map<string, DomainEvent[]>();
  private readonly log: PositionedEvent[] = [];
  private readonly resultByExternalRef = new Map<string, CommandResult>();
  private position = 0;

  append(
    aggregateId: string,
    expectedVersion: number,
    events: readonly DomainEvent[],
  ): Promise<CommandResult> {
    if (!events.length) {
      return Promise.resolve({ aggregateId, streamPosition: this.position });
    }

    const anchorRef = events[0].externalRef;
    const cached = this.cachedResultFor(anchorRef, events[0].userId);

    if (cached) return Promise.resolve(cached);

    const stream = this.byAggregate.get(aggregateId) ?? [];

    if (stream.length !== expectedVersion) {
      throw new LedgerConcurrencyException(
        `Expected version ${expectedVersion} for "${aggregateId}", found ${stream.length}`,
      );
    }

    for (const event of events) {
      this.position += 1;
      const stamped = new DomainEvent(
        event.type,
        event.aggregateId,
        event.aggregateType,
        event.sequence,
        event.userId,
        event.clientId,
        event.externalRef,
        event.occurredAt,
        event.payload,
        `evt-${this.position}`,
        new Date(event.occurredAt.getTime()),
      );
      stream.push(stamped);
      this.log.push({ position: this.position, event: stamped });
    }

    this.byAggregate.set(aggregateId, stream);

    const result: CommandResult = { aggregateId, streamPosition: this.position };

    if (anchorRef) this.resultByExternalRef.set(this.externalKey(anchorRef, events[0].userId), result);

    return Promise.resolve(result);
  }

  load(aggregateId: string): Promise<readonly DomainEvent[]> {
    return Promise.resolve([...(this.byAggregate.get(aggregateId) ?? [])]);
  }

  readAll(fromPosition: number): Promise<readonly PositionedEvent[]> {
    return Promise.resolve(this.log.filter((entry) => entry.position > fromPosition));
  }

  private cachedResultFor(externalRef: Nullable<string>, userId: string): Nullable<CommandResult> {
    if (!externalRef) return null;

    return this.resultByExternalRef.get(this.externalKey(externalRef, userId)) ?? null;
  }

  private externalKey(externalRef: string, userId: string): string {
    return `${userId}:${externalRef}`;
  }
}
