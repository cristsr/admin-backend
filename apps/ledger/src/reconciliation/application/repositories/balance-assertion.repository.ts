import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { EventRegistry } from '@cqrs/application/event/event-registry';
import { EventSourcedRepository } from '@cqrs/application/event-sourced.repository';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventStore } from '@cqrs/domain/ports/event-store';
import {
  BALANCE_ASSERTION,
  BalanceAssertion,
} from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';

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
