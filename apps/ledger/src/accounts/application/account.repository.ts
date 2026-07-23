import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { EventSourcedRepository } from '@ledger/shared-kernel/application/event-sourced.repository';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';

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
