import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { EventSourcedRepository } from '@ledger/shared-kernel/application/event-sourced.repository';
import { DomainEvent } from '@ledger/shared-kernel/domain/aggregate/domain-event';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';

/** Loads and persists {@link LedgerTransaction} aggregates over the event store. */
export class LedgerTransactionRepository extends EventSourcedRepository<LedgerTransaction> {
  protected readonly aggregateType = 'LedgerTransaction';

  constructor(eventStore: EventStore, registry: EventRegistry, envelopes: EnvelopeFactory) {
    super(eventStore, registry, envelopes);
  }

  protected rehydrate(id: string, events: readonly DomainEvent[]): LedgerTransaction {
    return LedgerTransaction.rehydrate(id, events);
  }
}
