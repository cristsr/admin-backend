import { AggregateRoot } from '../../../shared-kernel/domain/aggregate/aggregate-root';
import { DomainEvent } from '../../../shared-kernel/domain/aggregate/domain-event';

export class PriceRecorded extends DomainEvent {
  readonly eventType = 'PriceRecorded';
  readonly schemaVersion = 1;

  constructor(
    readonly base: string,
    readonly quote: string,
    readonly date: string,
    readonly rate: string,
    readonly source: string,
  ) {
    super();
  }

  toPayload() {
    return {
      base: this.base,
      quote: this.quote,
      date: this.date,
      rate: this.rate,
      source: this.source,
    };
  }
}

/**
 * Thin aggregate: price recording is append-only via PriceRecorded events.
 * LWW correction is handled in the projector by global_position.
 */
export class PriceFeed extends AggregateRoot<string> {
  static record(
    base: string,
    quote: string,
    date: string,
    rate: string,
    source: string,
  ): PriceFeed {
    const id = `${base}/${quote}/${date}/${source}`;
    const feed = new PriceFeed(id);
    feed.raise(new PriceRecorded(base, quote, date, rate, source));
    return feed;
  }

  static rehydrate(id: string, events: readonly DomainEvent[]): PriceFeed {
    const feed = new PriceFeed(id);
    feed.loadFromHistory(events);
    return feed;
  }

  protected apply(event: DomainEvent): void {
    // Thin aggregate: no state mutations, just replay
  }
}
