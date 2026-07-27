import { Global, Module } from '@nestjs/common';
import { CommandBus, PolicyCommandBus } from '@cqrs/application/command-bus/command-bus';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { PostgresEventStore } from '@cqrs/infrastructure/adapters/event-store/postgres/postgres-event-store';
import { PostgresReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store';
import { createLedgerApplication } from '@ledger/ledger/application/ledger-application.factory';
import { createQueryBus } from '@ledger/read-side/query-bus.factory';
import { ReadModelCurrencyCatalog } from '@ledger/reference/infrastructure/adapters/read-model-currency-catalog';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects/currency-catalog';
import { SystemClock } from '@ledger/shared/infrastructure/system-clock';
import { UuidIdGenerator } from '@ledger/shared/infrastructure/uuid-id-generator';

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
    // The catalog is served from proj_currencies but cached in memory: `resolve`
    // is synchronous and runs during stream rehydration (hu-0019).
    {
      provide: ReadModelCurrencyCatalog,
      inject: [ReadModelStore],
      useFactory: (readModel: ReadModelStore): ReadModelCurrencyCatalog =>
        new ReadModelCurrencyCatalog(readModel),
    },
    { provide: CurrencyCatalog, useExisting: ReadModelCurrencyCatalog },
    { provide: EventStore, useClass: PostgresEventStore },
    { provide: ReadModelStore, useClass: PostgresReadModelStore },
    // The concrete bus is the provider; `CommandBus` aliases it. Feature modules
    // composed outside this root (EP-3) inject `PolicyCommandBus` to register
    // their own handlers on the very same policy chain (INV-10, RF-11).
    {
      provide: PolicyCommandBus,
      inject: [EventStore, ReadModelStore, Clock, IdGenerator, CurrencyCatalog, ReadModelCurrencyCatalog],
      useFactory: (
        eventStore: EventStore,
        readModel: ReadModelStore,
        clock: Clock,
        idGenerator: IdGenerator,
        catalog: CurrencyCatalog,
        catalogCache: ReadModelCurrencyCatalog,
      ): PolicyCommandBus =>
        createLedgerApplication({
          eventStore,
          readModel,
          clock,
          idGenerator,
          catalog,
          catalogCache,
        }).commandBus,
    },
    { provide: CommandBus, useExisting: PolicyCommandBus },
    {
      provide: QueryBus,
      inject: [ReadModelStore],
      useFactory: (readModel: ReadModelStore): QueryBus => createQueryBus(readModel),
    },
  ],
  exports: [
    CommandBus,
    PolicyCommandBus,
    QueryBus,
    EventStore,
    ReadModelStore,
    CurrencyCatalog,
    ReadModelCurrencyCatalog,
    Clock,
    IdGenerator,
  ],
})
export class LedgerCoreModule {}
