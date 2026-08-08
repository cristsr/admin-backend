import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { EventRegistry } from '@cqrs/application/event/event-registry';
import { EventSourcedRepository } from '@cqrs/application/event-sourced.repository';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { LedgerSettings } from '@ledger/ledger/domain/settings/ledger-settings.aggregate';

/** Loads and persists the per-user {@link LedgerSettings} aggregate. */
export class LedgerSettingsRepository extends EventSourcedRepository<LedgerSettings> {
  protected readonly aggregateType = 'Ledger';

  constructor(eventStore: EventStore, registry: EventRegistry, envelopes: EnvelopeFactory) {
    super(eventStore, registry, envelopes);
  }

  protected rehydrate(id: string, events: readonly DomainEvent[]): LedgerSettings {
    return LedgerSettings.rehydrate(id, events);
  }
}
