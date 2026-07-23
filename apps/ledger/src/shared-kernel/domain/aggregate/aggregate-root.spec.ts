import { EventPayload } from '@ledger/shared-kernel/domain/event/event-payload.type';
import { AggregateRoot } from './aggregate-root';
import { DomainEvent } from './domain-event';

class Incremented extends DomainEvent {
  readonly eventType = 'Incremented';
  readonly schemaVersion = 1;

  constructor(readonly by: number) {
    super();
  }

  toPayload(): EventPayload {
    return { by: this.by };
  }
}

class Counter extends AggregateRoot<string> {
  private total = 0;

  static start(id: string): Counter {
    return new Counter(id);
  }

  add(by: number): void {
    this.raise(new Incremented(by));
  }

  get value(): number {
    return this.total;
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof Incremented) this.total += event.by;
  }
}

describe('AggregateRoot', () => {
  it('applies raised events to state and records them as uncommitted changes', () => {
    const counter = Counter.start('c1');
    counter.add(3);
    counter.add(4);

    expect(counter.value).toBe(7);
    expect(counter.pullChanges()).toHaveLength(2);
  });

  it('clears changes once pulled', () => {
    const counter = Counter.start('c1');
    counter.add(1);
    counter.pullChanges();

    expect(counter.pullChanges()).toHaveLength(0);
  });

  it('rehydrates from history and sets the version without re-recording changes', () => {
    const counter = Counter.start('c1');
    counter.loadFromHistory([new Incremented(5), new Incremented(2)]);

    expect(counter.value).toBe(7);
    expect(counter.version).toBe(2);
    expect(counter.pullChanges()).toHaveLength(0);
  });

  it('keeps the persisted version stable while new events are pending', () => {
    const counter = Counter.start('c1');
    counter.loadFromHistory([new Incremented(1)]);
    counter.add(9);

    // expectedVersion for the append is the persisted head, not the pending count.
    expect(counter.version).toBe(1);
    expect(counter.pullChanges()).toHaveLength(1);
  });
});
