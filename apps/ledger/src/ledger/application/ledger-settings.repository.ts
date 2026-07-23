import { LedgerSettings } from '@ledger/ledger/domain/settings/ledger-settings.aggregate';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { EventSourcedRepository } from '@ledger/shared-kernel/application/event-sourced.repository';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';

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
