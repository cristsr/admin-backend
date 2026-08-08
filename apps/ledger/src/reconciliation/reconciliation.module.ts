import { Module, OnModuleInit } from '@nestjs/common';
import { CommandBus, PolicyCommandBus } from '@cqrs/application/command-bus/command-bus';
import { EnvelopeFactory } from '@cqrs/application/event/envelope.factory';
import { EventRegistry } from '@cqrs/application/event/event-registry';
import { ProjectionCheckpointRepository } from '@cqrs/application/projection/projection-checkpoint.repository';
import { RegistryQueryBus } from '@cqrs/application/query-bus/query-bus';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { PostgresProjectionCheckpointRepository } from '@cqrs/infrastructure/adapters/projection/postgres-projection-checkpoint.repository';
import { BalanceAssertionRepository } from '@ledger/reconciliation/application/balance-assertion.repository';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects';
import { AssertBalanceCommand } from './application/assert-balance/assert-balance.command';
import { AssertBalanceHandler } from './application/assert-balance/assert-balance.handler';
import { EvaluateAssertionHandler } from './application/evaluate-assertion/evaluate-assertion.handler';
import { GetAssertionStatusHandler } from './application/get-assertion-status/get-assertion-status.handler';
import { GetAssertionStatusQuery } from './application/get-assertion-status/get-assertion-status.query';
import { ListAssertionsHandler } from './application/list-assertions/list-assertions.handler';
import { ListAssertionsQuery } from './application/list-assertions/list-assertions.query';
import { ReevaluateAssertionsReactor } from './application/reactors/reevaluate-assertions.reactor';
import { createReconciliationEventRegistry } from './application/reconciliation-event-registry.factory';
import { ResolveDiscrepancyCommand } from './application/resolve-discrepancy/resolve-discrepancy.command';
import { ResolveDiscrepancyHandler } from './application/resolve-discrepancy/resolve-discrepancy.handler';
import { RevokeAssertionCommand } from './application/revoke-assertion/revoke-assertion.command';
import { RevokeAssertionHandler } from './application/revoke-assertion/revoke-assertion.handler';
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
 * Reconciliation, mounted on the real core. The
 * event-sourced repository, envelope factory and a reconciliation-only event
 * registry are wired over the shared {@link EventStore}; the write handlers
 * orchestrate the real `RecordTransaction` through the {@link CommandBus}.
 *
 * The read models persist through the shared `ReadModelStore` like the rest of
 * the read side, and {@link ReconciliationPump} drives them from the global
 * stream on a persisted checkpoint.
 *
 * The write handlers are composed here but registered on the core's
 * {@link PolicyCommandBus} at init, so every reconciliation command enters
 * through the same policy chain as the rest (INV-10) instead of being
 * called as a provider. `EvaluateAssertion` stays off the bus on purpose: it is
 * internal — it is not part of the public command catalogue — and is dispatched by the reactor.
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
    // Domain and application classes carry no Nest decorators (rules
    // Art. 1), so each one states its dependencies here instead of relying on
    // `@Injectable` metadata. The wiring is the adapter's job, not the core's.
    {
      provide: AssertionEvaluator,
      inject: [AssertionPostingReader, DayBoundaryResolver],
      useFactory: (
        reader: AssertionPostingReader,
        dayBoundary: DayBoundaryResolver,
      ): AssertionEvaluator => new AssertionEvaluator(reader, dayBoundary),
    },
    { provide: AdjustmentFactory, useFactory: (): AdjustmentFactory => new AdjustmentFactory() },
    {
      provide: EvaluateAssertionHandler,
      inject: [BalanceAssertionRepository, AssertionEvaluator, LedgerSettingsReader, Clock],
      useFactory: (
        repository: BalanceAssertionRepository,
        evaluator: AssertionEvaluator,
        settings: LedgerSettingsReader,
        clock: Clock,
      ): EvaluateAssertionHandler =>
        new EvaluateAssertionHandler(repository, evaluator, settings, clock),
    },
    {
      provide: AssertBalanceHandler,
      inject: [BalanceAssertionRepository, EvaluateAssertionHandler, CurrencyCatalog, IdGenerator],
      useFactory: (
        repository: BalanceAssertionRepository,
        evaluate: EvaluateAssertionHandler,
        catalog: CurrencyCatalog,
        ids: IdGenerator,
      ): AssertBalanceHandler =>
        new AssertBalanceHandler(repository, evaluate, catalog, ids),
    },
    {
      provide: RevokeAssertionHandler,
      inject: [BalanceAssertionRepository],
      useFactory: (repository: BalanceAssertionRepository): RevokeAssertionHandler =>
        new RevokeAssertionHandler(repository),
    },
    {
      provide: ResolveDiscrepancyHandler,
      inject: [
        BalanceAssertionRepository,
        CommandBus,
        SystemAccountLookup,
        AdjustmentFactory,
        Clock,
        EventStore,
      ],
      useFactory: (
        assertions: BalanceAssertionRepository,
        commandBus: CommandBus,
        accounts: SystemAccountLookup,
        factory: AdjustmentFactory,
        clock: Clock,
        eventStore: EventStore,
      ): ResolveDiscrepancyHandler =>
        new ResolveDiscrepancyHandler(assertions, commandBus, accounts, factory, clock, eventStore),
    },
    {
      provide: ReevaluateAssertionsReactor,
      inject: [AssertionLookupPort, EvaluateAssertionHandler, AssertionPostingReader],
      useFactory: (
        affectedAssertions: AssertionLookupPort,
        evaluate: EvaluateAssertionHandler,
        postings: AssertionPostingReader,
      ): ReevaluateAssertionsReactor =>
        new ReevaluateAssertionsReactor(affectedAssertions, evaluate, postings),
    },
    {
      provide: GetAssertionStatusHandler,
      inject: [AssertionStatusStore],
      useFactory: (store: AssertionStatusStore): GetAssertionStatusHandler =>
        new GetAssertionStatusHandler(store),
    },
    {
      provide: ListAssertionsHandler,
      inject: [AssertionStatusStore],
      useFactory: (store: AssertionStatusStore): ListAssertionsHandler =>
        new ListAssertionsHandler(store),
    },
    AssertionStatusProjector,
    AdjustmentAuditProjector,
    ReconciliationPump,
  ],
})
export class ReconciliationModule implements OnModuleInit {
  constructor(
    private readonly commandBus: PolicyCommandBus,
    private readonly queryBus: RegistryQueryBus,
    private readonly assertBalance: AssertBalanceHandler,
    private readonly revokeAssertion: RevokeAssertionHandler,
    private readonly resolveDiscrepancy: ResolveDiscrepancyHandler,
    private readonly getAssertionStatus: GetAssertionStatusHandler,
    private readonly listAssertions: ListAssertionsHandler,
  ) {}

  onModuleInit(): void {
    this.commandBus.register(AssertBalanceCommand, this.assertBalance);
    this.commandBus.register(RevokeAssertionCommand, this.revokeAssertion);
    this.commandBus.register(ResolveDiscrepancyCommand, this.resolveDiscrepancy);

    // The reads join the same bus as every other module's. They are registered
    // here rather than in `createQueryBus` because `AssertionStatusStore` is
    // bound in this module, and the composition root must not know about it.
    this.queryBus.register(GetAssertionStatusQuery, this.getAssertionStatus);
    this.queryBus.register(ListAssertionsQuery, this.listAssertions);
  }
}
