import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { EventRegistry } from '@cqrs/application/event/event-registry';
import { EventSourcedRepository } from '@cqrs/application/event-sourced.repository';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { Nullable } from '@shared';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';

/** Loads and persists {@link LedgerTransaction} aggregates over the event store. */
export class LedgerTransactionRepository extends EventSourcedRepository<LedgerTransaction> {
  protected readonly aggregateType = 'LedgerTransaction';

  constructor(eventStore: EventStore, registry: EventRegistry, envelopes: EnvelopeFactory) {
    super(eventStore, registry, envelopes);
  }

  /**
   * The `external_ref` the client stamped on the transaction's anchor event, or
   * `null` when the transaction was created by the system (merging needs both
   * legs' references as merge traceability metadata).
   *
   * It is read from the aggregate's own stream, never from `proj_transactions`:
   * the write side does not read projections, and the read model
   * may lag behind the very aggregates the command just loaded. The reference
   * lives in the envelope, not in `LedgerTransaction`, so the aggregate stays
   * free of an idempotency concern that belongs to the append.
   */
  async externalRefOf(userId: string, transactionId: string): Promise<Nullable<string>> {
    const stored = await this.eventStore.load({
      userId,
      aggregateType: this.aggregateType,
      aggregateId: transactionId,
    });

    return stored.find((event) => !!event.externalRef)?.externalRef ?? null;
  }

  protected rehydrate(id: string, events: readonly DomainEvent[]): LedgerTransaction {
    return LedgerTransaction.rehydrate(id, events);
  }
}
