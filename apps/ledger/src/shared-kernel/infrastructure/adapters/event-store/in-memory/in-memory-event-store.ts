import { Nullable } from '@shared';
import { AppendResult } from '@ledger/shared-kernel/domain/event/append-result.type';
import { EventEnvelope } from '@ledger/shared-kernel/domain/event/event-envelope.type';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { StreamId } from '@ledger/shared-kernel/domain/event/stream-id.type';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@ledger/shared-kernel/domain/exceptions/event-store.exception';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';

/**
 * In-memory reference implementation of {@link EventStore} (RNF-11). A single
 * monotonic counter models `global_position`; all invariants are enforced in
 * process, mirroring the PostgreSQL adapter so both pass one contract suite.
 * Node's single thread makes the append read-check-write step atomic.
 */
export class InMemoryEventStore extends EventStore {
  private readonly events: StoredEvent[] = [];
  private nextPosition = 1n;

  async append(
    stream: StreamId,
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): Promise<AppendResult> {
    const current = this.streamEvents(stream);

    if (current.length !== expectedVersion) {
      throw new ConcurrencyConflictException(
        `Expected version ${expectedVersion} for ${stream.aggregateId}, found ${current.length}`,
      );
    }

    this.ensureConsecutiveSequences(expectedVersion, events);
    this.ensureExternalRefsAreFresh(stream.userId, events);

    const stored = events.map<StoredEvent>((envelope) => ({
      ...envelope,
      globalPosition: this.nextPosition++,
    }));
    this.events.push(...stored);

    return {
      events: stored,
      version: expectedVersion + stored.length,
      lastPosition: stored[stored.length - 1].globalPosition,
    };
  }

  async load(stream: StreamId): Promise<readonly StoredEvent[]> {
    return this.streamEvents(stream);
  }

  async readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]> {
    return this.events
      .filter((event) => event.globalPosition > fromPosition)
      .sort((a, b) => Number(a.globalPosition - b.globalPosition))
      .slice(0, limit);
  }

  async findByExternalRef(
    userId: string,
    externalRef: string,
  ): Promise<Nullable<StoredEvent>> {
    return (
      this.events.find(
        (event) => event.userId === userId && event.externalRef === externalRef,
      ) ?? null
    );
  }

  private streamEvents(stream: StreamId): StoredEvent[] {
    return this.events
      .filter(
        (event) =>
          event.userId === stream.userId && event.aggregateId === stream.aggregateId,
      )
      .sort((a, b) => a.sequence - b.sequence);
  }

  /** Sequences within a batch must continue strictly from the head (INV-7). */
  private ensureConsecutiveSequences(
    expectedVersion: number,
    events: readonly EventEnvelope[],
  ): void {
    const outOfOrder = events.some(
      (event, index) => event.sequence !== expectedVersion + index + 1,
    );

    if (outOfOrder) {
      throw new ConcurrencyConflictException(
        `Batch sequences are not consecutive from version ${expectedVersion}`,
      );
    }
  }

  /** No two events share a user's external_ref (INV-10, defense-in-depth). */
  private ensureExternalRefsAreFresh(
    userId: string,
    events: readonly EventEnvelope[],
  ): void {
    for (const event of events) {
      if (!event.externalRef) continue;

      const clash = this.events.some(
        (stored) => stored.userId === userId && stored.externalRef === event.externalRef,
      );

      if (clash) {
        throw new DuplicateExternalRefException(
          `external_ref "${event.externalRef}" already used by user ${userId}`,
        );
      }
    }
  }
}
