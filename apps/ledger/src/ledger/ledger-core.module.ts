import { Global, Module } from '@nestjs/common';
import { CommandBus, PolicyCommandBus } from '@cqrs/application/command-bus/command-bus';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { QueryBus, RegistryQueryBus } from '@cqrs/application/query-bus/query-bus';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { PostgresEventStore } from '@cqrs/infrastructure/adapters/event-store/postgres/postgres-event-store';
import { PostgresReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store';
import { SystemClock } from '@cqrs/infrastructure/adapters/system-clock';
import { UuidIdGenerator } from '@cqrs/infrastructure/adapters/uuid-id-generator';
import { createLedgerApplication } from '@ledger/bootstrap/ledger-application.factory';
import { createQueryBus } from '@ledger/bootstrap/query-bus.factory';
import { LedgerSettingsFinder } from '@ledger/ledger/application/ports/ledger-settings-finder.port';
import { LedgerTimezoneReader } from '@ledger/ledger/application/ports/ledger-timezone-reader.port';
import { SystemAccountLookup } from '@ledger/ledger/application/ports/system-account-lookup.port';
import { ReadModelLedgerSettingsFinder } from '@ledger/ledger/infrastructure/adapters/persistence/read-model-ledger-settings-finder';
import { ReadModelLedgerTimezoneReader } from '@ledger/ledger/infrastructure/adapters/persistence/read-model-ledger-timezone-reader';
import { ReadModelSystemAccountLookup } from '@ledger/ledger/infrastructure/adapters/persistence/read-model-system-account-lookup';
import { ReadModelCurrencyCatalog } from '@ledger/reference/infrastructure/adapters/read-model-currency-catalog';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects/currency-catalog';

/**
 * Composition root that mounts the real write and read buses into Nest DI, so
 * the HTTP adapters resolve the same `CommandBus`/`QueryBus` the tests exercise
 * directly. Global, so every feature module inherits them.
 */
@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidIdGenerator },
    // The catalog is served from proj_currencies but cached in memory: `resolve`
    // is synchronous and runs during stream rehydration.
    {
      provide: ReadModelCurrencyCatalog,
      inject: [ReadModelStore],
      useFactory: (readModel: ReadModelStore): ReadModelCurrencyCatalog =>
        new ReadModelCurrencyCatalog(readModel),
    },
    { provide: CurrencyCatalog, useExisting: ReadModelCurrencyCatalog },
    { provide: EventStore, useClass: PostgresEventStore },
    { provide: ReadModelStore, useClass: PostgresReadModelStore },
    // The ledger's read ports, bound where the module that owns the read model
    // lives. `LedgerTimezoneReader` is consumed by `ReconciliationModule`, which
    // injects it from here; the other two also reach the factories through the
    // store-backed composition, so this binding is what the Nest wiring and the
    // in-memory one share.
    { provide: LedgerSettingsFinder, useClass: ReadModelLedgerSettingsFinder },
    { provide: LedgerTimezoneReader, useClass: ReadModelLedgerTimezoneReader },
    { provide: SystemAccountLookup, useClass: ReadModelSystemAccountLookup },
    // The concrete bus is the provider; `CommandBus` aliases it. Feature modules
    // composed outside this root inject `PolicyCommandBus` to register
    // their own handlers on the very same policy chain (INV-10).
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
    // Same shape as the command side: the concrete bus is the provider and
    // `QueryBus` aliases it, so a module that binds its own read port can
    // register its handlers on the one bus the controllers ask through.
    {
      provide: RegistryQueryBus,
      inject: [ReadModelStore],
      useFactory: (readModel: ReadModelStore): RegistryQueryBus => createQueryBus(readModel),
    },
    { provide: QueryBus, useExisting: RegistryQueryBus },
  ],
  exports: [
    CommandBus,
    PolicyCommandBus,
    QueryBus,
    RegistryQueryBus,
    EventStore,
    ReadModelStore,
    CurrencyCatalog,
    ReadModelCurrencyCatalog,
    Clock,
    IdGenerator,
    LedgerSettingsFinder,
    LedgerTimezoneReader,
    SystemAccountLookup,
  ],
})
export class LedgerCoreModule {}
