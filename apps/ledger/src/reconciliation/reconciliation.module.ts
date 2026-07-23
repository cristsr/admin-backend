import { Module } from '@nestjs/common';
import { AssertBalanceHandler } from './application/commands/assert-balance.handler';
import { EvaluateAssertionHandler } from './application/commands/evaluate-assertion.handler';
import { ResolveDiscrepancyHandler } from './application/commands/resolve-discrepancy.handler';
import { RevokeAssertionHandler } from './application/commands/revoke-assertion.handler';
import { AdjustmentAuditProjector } from './application/projectors/adjustment-audit.projector';
import { AssertionStatusProjector } from './application/projectors/assertion-status.projector';
import { GetAssertionStatusHandler } from './application/queries/get-assertion-status.query';
import { ListAssertionsHandler } from './application/queries/list-assertions.query';
import { ReevaluateAssertionsReactor } from './application/reactors/reevaluate-assertions.reactor';
import { BalanceAssertionRepository } from './domain/balance-assertion/balance-assertion.repository';
import { AdjustmentAuditStore } from './domain/ports/adjustment-audit-store.port';
import { AssertionLookupPort } from './domain/ports/assertion-lookup.port';
import { AssertionPostingReader } from './domain/ports/assertion-posting-reader.port';
import { AssertionStatusStore } from './domain/ports/assertion-status-store.port';
import { AdjustmentFactory } from './domain/services/adjustment.factory';
import { AssertionEvaluator } from './domain/services/assertion-evaluator.service';
import { DayBoundaryResolver, IntlDayBoundaryResolver } from './domain/services/day-boundary.resolver';
import { ReevaluateAssertionsEventHandler } from './infrastructure/adapters/events/reevaluate-assertions.event-handler';
import { BalanceAssertionController } from './infrastructure/adapters/http/balance-assertion.controller';
import { EventStoreBalanceAssertionRepository } from './infrastructure/adapters/persistence/event-store-balance-assertion.repository';
import { InMemoryAdjustmentAuditStore } from './infrastructure/adapters/persistence/in-memory/in-memory-adjustment-audit-store';
import { InMemoryAssertionPostingReader } from './infrastructure/adapters/persistence/in-memory/in-memory-assertion-posting-reader';
import { InMemoryAssertionStatusStore } from './infrastructure/adapters/persistence/in-memory/in-memory-assertion-status-store';
import { StoreBackedAssertionLookup } from './infrastructure/adapters/persistence/store-backed-assertion-lookup';

/**
 * Reconciliation module (EP-3.1–EP-3.6). Ports are bound to their adapters; the
 * assumed EP-1/EP-2 collaborators (`EventStore`, `CommandBus`, `QueryBus`,
 * `LedgerSettingsReader`, `SystemAccountLookup`) are provided by their modules
 * at integration. The in-memory read models are placeholders the TypeORM
 * adapters replace once EP-1's persistence lands.
 */
@Module({
  controllers: [BalanceAssertionController],
  providers: [
    AssertionEvaluator,
    AdjustmentFactory,
    { provide: DayBoundaryResolver, useClass: IntlDayBoundaryResolver },
    { provide: BalanceAssertionRepository, useClass: EventStoreBalanceAssertionRepository },
    { provide: AssertionPostingReader, useClass: InMemoryAssertionPostingReader },
    { provide: AssertionStatusStore, useClass: InMemoryAssertionStatusStore },
    { provide: AdjustmentAuditStore, useClass: InMemoryAdjustmentAuditStore },
    { provide: AssertionLookupPort, useClass: StoreBackedAssertionLookup },
    AssertBalanceHandler,
    EvaluateAssertionHandler,
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
