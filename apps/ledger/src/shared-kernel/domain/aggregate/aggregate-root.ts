import { DomainEvent } from './domain-event';

/**
 * Base for event-sourced aggregates. `apply` mutates state only; `raise`
 * records a new event and applies it. `version` is the persisted head sequence
 * (0 for a brand-new stream) and is the value used as `expectedVersion` when
 * appending — pending, un-persisted changes never move it.
 */
export abstract class AggregateRoot<TId> {
  private persistedVersion = 0;
  private readonly changes: DomainEvent[] = [];

  protected constructor(readonly id: TId) {}

  /** Persisted head sequence; the append's optimistic concurrency token. */
  get version(): number {
    return this.persistedVersion;
  }

  /** Returns and clears the uncommitted events raised since the last pull. */
  pullChanges(): readonly DomainEvent[] {
    const pending = [...this.changes];
    this.changes.length = 0;

    return pending;
  }

  /** Replays persisted history to rebuild state and advance the version. */
  loadFromHistory(events: readonly DomainEvent[]): void {
    for (const event of events) {
      this.apply(event);
      this.persistedVersion += 1;
    }
  }

  /** Records and applies a new event as an uncommitted change. */
  protected raise(event: DomainEvent): void {
    this.apply(event);
    this.changes.push(event);
  }

  /** Mutates state from an event. Must never throw for a valid stored event. */
  protected abstract apply(event: DomainEvent): void;
}
