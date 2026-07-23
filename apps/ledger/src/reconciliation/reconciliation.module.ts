import { Module } from '@nestjs/common';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { CurrencyCatalog } from '@ledger/shared-kernel/domain/value-objects';
import { AssertBalanceHandler } from './application/commands/assert-balance.handler';
import { EvaluateAssertionHandler } from './application/commands/evaluate-assertion.handler';
import { ResolveDiscrepancyHandler } from './application/commands/resolve-discrepancy.handler';
import { RevokeAssertionHandler } from './application/commands/revoke-assertion.handler';
import { AdjustmentAuditProjector } from './application/projectors/adjustment-audit.projector';
import { AssertionStatusProjector } from './application/projectors/assertion-status.projector';
import { GetAssertionStatusHandler } from './application/queries/get-assertion-status.query';
import { ListAssertionsHandler } from './application/queries/list-assertions.query';
import { ReevaluateAssertionsReactor } from './application/reactors/reevaluate-assertions.reactor';
import { createReconciliationEventRegistry } from './application/reconciliation-event-registry.factory';
import { AdjustmentAuditStore } from './domain/ports/adjustment-audit-store.port';
import { AssertionLookupPort } from './domain/ports/assertion-lookup.port';
import { AssertionPostingReader } from './domain/ports/assertion-posting-reader.port';
import { AssertionStatusStore } from './domain/ports/assertion-status-store.port';
import { LedgerSettingsReader } from './domain/ports/ledger-settings-reader.port';
import { SystemAccountLookup } from './domain/ports/system-account-lookup.port';
import { AdjustmentFactory } from './domain/services/adjustment.factory';
import { AssertionEvaluator } from './domain/services/assertion-evaluator.service';
import { DayBoundaryResolver, IntlDayBoundaryResolver } from './domain/services/day-boundary.resolver';
import { ReevaluateAssertionsEventHandler } from './infrastructure/adapters/events/reevaluate-assertions.event-handler';
import { BalanceAssertionController } from './infrastructure/adapters/http/balance-assertion.controller';
import { InMemoryAdjustmentAuditStore } from './infrastructure/adapters/persistence/in-memory/in-memory-adjustment-audit-store';
import { InMemoryAssertionStatusStore } from './infrastructure/adapters/persistence/in-memory/in-memory-assertion-status-store';
import { ReadModelAssertionPostingReader } from './infrastructure/adapters/persistence/read-model-assertion-posting-reader';
import { ReadModelLedgerSettingsReader } from './infrastructure/adapters/persistence/read-model-ledger-settings-reader';
import { ReadModelSystemAccountLookup } from './infrastructure/adapters/persistence/read-model-system-account-lookup';
import { StoreBackedAssertionLookup } from './infrastructure/adapters/persistence/store-backed-assertion-lookup';

/**
 * Reconciliation module (EP-3.1–EP-3.6), mounted on the real EP-1 core. The
 * event-sourced repository, envelope factory and a reconciliation-only event
 * registry are wired over the shared {@link EventStore}; the write handlers
 * orchestrate the real `RecordTransaction` through the {@link CommandBus}. The
 * read models are bespoke in-memory doubles driven by the async pump
 * (TODO(persistence): swap for TypeORM adapters once EP-1's persistence lands).
 */
@Module({
  controllers: [BalanceAssertionController],
  providers: [
    {
      provide: EventRegistry,
      inject: [CurrencyCatalog],
      useFactory: (catalog: CurrencyCatalog): EventRegistry =>
        createReconciliationEventRegistry(catalog),
    },
    {
      provide: EnvelopeFactory,
      inject: [Clock, IdGenerator],
      useFactory: (clock: Clock, ids: IdGenerator): EnvelopeFactory =>
        new EnvelopeFactory(clock, ids),
    },
    {
      provide: BalanceAssertionRepository,
      inject: [EventStore, EventRegistry, EnvelopeFactory],
      useFactory: (
        eventStore: EventStore,
        registry: EventRegistry,
        envelopes: EnvelopeFactory,
      ): BalanceAssertionRepository =>
        new BalanceAssertionRepository(eventStore, registry, envelopes),
    },
    {
      provide: AdjustmentAuditStore,
      inject: [CurrencyCatalog],
      useFactory: (catalog: CurrencyCatalog): AdjustmentAuditStore =>
        new InMemoryAdjustmentAuditStore(catalog),
    },
    { provide: DayBoundaryResolver, useClass: IntlDayBoundaryResolver },
    { provide: AssertionPostingReader, useClass: ReadModelAssertionPostingReader },
    { provide: AssertionStatusStore, useClass: InMemoryAssertionStatusStore },
    { provide: AssertionLookupPort, useClass: StoreBackedAssertionLookup },
    { provide: LedgerSettingsReader, useClass: ReadModelLedgerSettingsReader },
    { provide: SystemAccountLookup, useClass: ReadModelSystemAccountLookup },
    AssertionEvaluator,
    AdjustmentFactory,
    EvaluateAssertionHandler,
    AssertBalanceHandler,
    RevokeAssertionHandler,
    ResolveDiscrepancyHandler,
    AssertionStatusProjector,
    AdjustmentAuditProjector,
    ReevaluateAssertionsReactor,
    ReevaluateAssertionsEventHandler,
    GetAssertionStatusHandler,
    ListAssertionsHandler,
  ],
})
export class ReconciliationModule {}
