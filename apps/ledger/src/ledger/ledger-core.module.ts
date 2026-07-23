import { Global, Module } from '@nestjs/common';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { createQueryBus } from '@ledger/read-side/query-bus.factory';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import { SystemClock } from '@ledger/shared/infrastructure/system-clock';
import { UuidIdGenerator } from '@ledger/shared/infrastructure/uuid-id-generator';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { QueryBus } from '@ledger/shared-kernel/application/query-bus/query-bus';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { CurrencyCatalog } from '@ledger/shared-kernel/domain/value-objects/currency-catalog';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { PostgresEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/postgres/postgres-event-store';
import { PostgresReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store';

/**
 * Composition root that mounts EP-1's real write/read buses into Nest DI so the
 * HTTP adapters (EP-2/EP-3) resolve the same `CommandBus`/`QueryBus` the tests
 * exercise directly. Global, so every feature module inherits the buses.
 *
 * EP-5.0: Swapped to PostgreSQL persistence adapters for production readiness.
 * EventStore and ReadModelStore now persist to Postgres with LWW conflict resolution
 * via global_position and checkpoint-based projection lag tracking (RNF-5, RNF-9).
 */
@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidIdGenerator },
    { provide: CurrencyCatalog, useClass: SeedCurrencyCatalog },
    { provide: EventStore, useClass: PostgresEventStore },
    { provide: ReadModelStore, useClass: PostgresReadModelStore },
    {
      provide: CommandBus,
      inject: [EventStore, ReadModelStore, Clock, IdGenerator, CurrencyCatalog],
      useFactory: (
        eventStore: EventStore,
        readModel: ReadModelStore,
        clock: Clock,
        idGenerator: IdGenerator,
        catalog: CurrencyCatalog,
      ): CommandBus =>
        createLedgerApplication({ eventStore, readModel, clock, idGenerator, catalog }).commandBus,
    },
    {
      provide: QueryBus,
      inject: [ReadModelStore],
      useFactory: (readModel: ReadModelStore): QueryBus => createQueryBus(readModel),
    },
  ],
  exports: [CommandBus, QueryBus, EventStore, ReadModelStore, CurrencyCatalog, Clock, IdGenerator],
})
export class LedgerCoreModule {}
