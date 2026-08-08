import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { EventRegistry } from '@cqrs/application/event/event-registry';
import { EventSourcedRepository } from '@cqrs/application/event-sourced.repository';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';

/** Loads and persists {@link Account} aggregates over the event store. */
export class AccountRepository extends EventSourcedRepository<Account> {
  protected readonly aggregateType = 'Account';

  constructor(eventStore: EventStore, registry: EventRegistry, envelopes: EnvelopeFactory) {
    super(eventStore, registry, envelopes);
  }

  protected rehydrate(id: string, events: readonly DomainEvent[]): Account {
    return Account.rehydrate(id, events);
  }
}
