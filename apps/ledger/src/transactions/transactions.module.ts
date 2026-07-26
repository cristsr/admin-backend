import { Module } from '@nestjs/common';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { CurrencyCatalog } from '@ledger/shared-kernel/domain/value-objects';
import { MergePendingTransfersHandler } from './application/commands/merge-pending-transfers.handler';
import { LedgerTransactionRepository } from './application/ledger-transaction.repository';
import { AccountLookup } from './domain/ports/account-lookup.port';
import { TransferPairRule } from './domain/services/transfer-pair.rule';
import { TransferController } from './infrastructure/adapters/http/transfer.controller';
import { ReadModelAccountLookup } from './infrastructure/adapters/persistence/read-model-account-lookup';

/**
 * Transfer merging (RF-16) mounted on the real EP-1 core: the merge command
 * reuses `RecordTransaction`/`VoidPendingTransaction` through the CommandBus
 * (DRY) and validates the pair against the aggregates it loads from the event
 * store. Proposing which pendings *look* mergeable is deliberately out of scope
 * — that heuristic belongs to the client, not to this ledger.
 */
@Module({
  controllers: [TransferController],
  providers: [
    TransferPairRule,
    { provide: AccountLookup, useClass: ReadModelAccountLookup },
    {
      provide: EventRegistry,
      inject: [CurrencyCatalog],
      useFactory: (catalog: CurrencyCatalog): EventRegistry => createLedgerEventRegistry(catalog),
    },
    {
      provide: EnvelopeFactory,
      inject: [Clock, IdGenerator],
      useFactory: (clock: Clock, ids: IdGenerator): EnvelopeFactory =>
        new EnvelopeFactory(clock, ids),
    },
    {
      provide: LedgerTransactionRepository,
      inject: [EventStore, EventRegistry, EnvelopeFactory],
      useFactory: (
        eventStore: EventStore,
        registry: EventRegistry,
        envelopes: EnvelopeFactory,
      ): LedgerTransactionRepository =>
        new LedgerTransactionRepository(eventStore, registry, envelopes),
    },
    MergePendingTransfersHandler,
  ],
})
export class TransactionsModule {}
