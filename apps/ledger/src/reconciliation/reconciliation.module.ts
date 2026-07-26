import { Module } from '@nestjs/common';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { EnvelopeFactory } from '@ledger/shared-kernel/application/event/envelope.factory';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import { ProjectionCheckpointRepository } from '@ledger/shared-kernel/application/projection/projection-checkpoint.repository';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { CurrencyCatalog } from '@ledger/shared-kernel/domain/value-objects';
import { PostgresProjectionCheckpointRepository } from '@ledger/shared-kernel/infrastructure/adapters/projection/postgres-projection-checkpoint.repository';
import { AssertBalanceHandler } from './application/commands/assert-balance.handler';
import { EvaluateAssertionHandler } from './application/commands/evaluate-assertion.handler';
import { ResolveDiscrepancyHandler } from './application/commands/resolve-discrepancy.handler';
import { RevokeAssertionHandler } from './application/commands/revoke-assertion.handler';
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
import { ReconciliationPump } from './infrastructure/adapters/events/reconciliation.pump';
import { BalanceAssertionController } from './infrastructure/adapters/http/balance-assertion.controller';
import { ReadModelAdjustmentAuditReader } from './infrastructure/adapters/persistence/read-model-adjustment-audit-reader';
import { ReadModelAssertionPostingReader } from './infrastructure/adapters/persistence/read-model-assertion-posting-reader';
import { ReadModelAssertionStatusReader } from './infrastructure/adapters/persistence/read-model-assertion-status-reader';
import { ReadModelLedgerSettingsReader } from './infrastructure/adapters/persistence/read-model-ledger-settings-reader';
import { ReadModelSystemAccountLookup } from './infrastructure/adapters/persistence/read-model-system-account-lookup';
import { StoreBackedAssertionLookup } from './infrastructure/adapters/persistence/store-backed-assertion-lookup';
import { AdjustmentAuditProjector } from './infrastructure/projections/adjustment-audit.projector';
import { AssertionStatusProjector } from './infrastructure/projections/assertion-status.projector';

/**
 * Reconciliation module (EP-3.1–EP-3.6), mounted on the real EP-1 core. The
 * event-sourced repository, envelope factory and a reconciliation-only event
 * registry are wired over the shared {@link EventStore}; the write handlers
 * orchestrate the real `RecordTransaction` through the {@link CommandBus}.
 *
 * The read models persist through the shared `ReadModelStore` like the rest of
 * the read side, and {@link ReconciliationPump} drives them from the global
 * stream on a persisted checkpoint (§8.1).
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
    { provide: AdjustmentAuditStore, useClass: ReadModelAdjustmentAuditReader },
    { provide: AssertionStatusStore, useClass: ReadModelAssertionStatusReader },
    { provide: ProjectionCheckpointRepository, useClass: PostgresProjectionCheckpointRepository },
    { provide: AssertionStatusProjector, useFactory: (): AssertionStatusProjector => new AssertionStatusProjector() },
    {
      provide: AdjustmentAuditProjector,
      inject: [CurrencyCatalog],
      useFactory: (catalog: CurrencyCatalog): AdjustmentAuditProjector =>
        new AdjustmentAuditProjector(catalog),
    },
    { provide: DayBoundaryResolver, useClass: IntlDayBoundaryResolver },
    { provide: AssertionPostingReader, useClass: ReadModelAssertionPostingReader },
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
    ReconciliationPump,
    GetAssertionStatusHandler,
    ListAssertionsHandler,
  ],
})
export class ReconciliationModule {}
