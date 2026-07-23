import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { EventSourcedRepository } from '@ledger/shared-kernel/application/event-sourced.repository';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { BALANCE_ASSERTION, BalanceAssertion } from './balance-assertion.aggregate';

/** Loads and persists {@link BalanceAssertion} aggregates over the event store. */
export class BalanceAssertionRepository extends EventSourcedRepository<BalanceAssertion> {
  protected readonly aggregateType = BALANCE_ASSERTION;

  constructor(eventStore: EventStore, registry: EventRegistry, envelopes: EnvelopeFactory) {
    super(eventStore, registry, envelopes);
  }

  protected rehydrate(id: string, events: readonly DomainEvent[]): BalanceAssertion {
    return BalanceAssertion.rehydrate(id, events);
  }
}
