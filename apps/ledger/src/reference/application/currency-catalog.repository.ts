import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { EventRegistry } from '@cqrs/application/event/event-registry';
import { EventSourcedRepository } from '@cqrs/application/event-sourced.repository';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventStore } from '@cqrs/domain/ports/event-store';
import {
  CURRENCY_CATALOG_ID,
  CurrencyCatalogAggregate,
} from '@ledger/reference/domain/currency/currency-catalog.aggregate';

/**
 * Reserved owner of the reference catalog stream.
 *
 * `StreamId` requires a `userId` and the event store filters every read by it
 * (INV-9), but the catalog is global — a currency's precision belongs to no
 * user. A constant system id keeps the stream addressable without pretending it
 * belongs to someone. Declared exception, same one AC-2 already took on
 * Artículo 5.
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/** Loads and persists the single, global {@link CurrencyCatalogAggregate}. */
export class CurrencyCatalogRepository extends EventSourcedRepository<CurrencyCatalogAggregate> {
  protected readonly aggregateType = 'CurrencyCatalog';

  constructor(eventStore: EventStore, registry: EventRegistry, envelopes: EnvelopeFactory) {
    super(eventStore, registry, envelopes);
  }

  /** Loads the catalog, or an empty one the first time. */
  async loadCatalog(): Promise<CurrencyCatalogAggregate> {
    const existing = await this.load(SYSTEM_USER_ID, CURRENCY_CATALOG_ID);

    return existing ?? CurrencyCatalogAggregate.rehydrate([]);
  }

  protected rehydrate(_id: string, events: readonly DomainEvent[]): CurrencyCatalogAggregate {
    return CurrencyCatalogAggregate.rehydrate(events);
  }
}
