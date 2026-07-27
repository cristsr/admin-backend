import { Module, OnModuleInit } from '@nestjs/common';
import { createLedgerEventRegistry } from '@ledger/ledger/application/ledger-event-registry.factory';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { CommandBus, PolicyCommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
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
 *
 * The handler is composed here but registered on the core's
 * {@link PolicyCommandBus} at init, so `MergePendingTransfers` enters through
 * the same policy chain as every other command (RF-11, INV-10) instead of being
 * called as a provider.
 */
@Module({
  controllers: [TransferController],
  providers: [
    // No Nest decorators in domain/application (RNF-11, rules Art. 1), so the
    // dependencies are stated here rather than read off `@Injectable` metadata.
    { provide: TransferPairRule, useFactory: (): TransferPairRule => new TransferPairRule() },
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
    {
      provide: MergePendingTransfersHandler,
      inject: [
        LedgerTransactionRepository,
        AccountLookup,
        TransferPairRule,
        CommandBus,
        EventStore,
      ],
      useFactory: (
        transactions: LedgerTransactionRepository,
        accounts: AccountLookup,
        rule: TransferPairRule,
        commandBus: CommandBus,
        eventStore: EventStore,
      ): MergePendingTransfersHandler =>
        new MergePendingTransfersHandler(transactions, accounts, rule, commandBus, eventStore),
    },
  ],
})
export class TransactionsModule implements OnModuleInit {
  constructor(
    private readonly commandBus: PolicyCommandBus,
    private readonly mergeTransfers: MergePendingTransfersHandler,
  ) {}

  onModuleInit(): void {
    this.commandBus.register('MergePendingTransfers', this.mergeTransfers);
  }
}
