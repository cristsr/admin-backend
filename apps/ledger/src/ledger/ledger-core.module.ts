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
import { InMemoryEventStore } from '@ledger/shared-kernel/infrastructure/adapters/event-store/in-memory/in-memory-event-store';
import { InMemoryReadModelStore } from '@ledger/shared-kernel/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';

/**
 * Composition root that mounts EP-1's real write/read buses into Nest DI so the
 * HTTP adapters (EP-2/EP-3) resolve the same `CommandBus`/`QueryBus` the tests
 * exercise directly. Global, so every feature module inherits the buses.
 *
 * TODO(persistence): this wires the in-memory {@link EventStore} and
 * {@link ReadModelStore} doubles — correct for a single-process dev run and the
 * contract suites (RNF-11). Swap {@link InMemoryEventStore} for the Postgres
 * adapter and {@link InMemoryReadModelStore} for the Postgres read-model store
 * once EP-1's persistence adapters land; the composition and the projection
 * dispatcher are already wired for read-your-writes (RNF-9).
 */
@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidIdGenerator },
    { provide: CurrencyCatalog, useClass: SeedCurrencyCatalog },
    { provide: EventStore, useClass: InMemoryEventStore },
    { provide: ReadModelStore, useClass: InMemoryReadModelStore },
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
