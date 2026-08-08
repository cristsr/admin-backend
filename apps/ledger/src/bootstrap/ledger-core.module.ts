import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
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
import {
  createQueryPorts,
  createWriteSideReadPorts,
  withSqlTransactionFinder,
} from '@ledger/bootstrap/read-side-ports.factory';
import { LedgerTimezoneReader } from '@ledger/ledger/application/ports/ledger-timezone-reader.port';
import { SystemAccountLookup } from '@ledger/ledger/application/ports/system-account-lookup.port';
import { ReadModelLedgerTimezoneReader } from '@ledger/ledger/infrastructure/adapters/persistence/read-model-ledger-timezone-reader';
import { CurrencyCatalogCache } from '@ledger/reference/application/ports/currency-catalog-cache.port';
import { ReadModelCurrencyCatalog } from '@ledger/reference/infrastructure/adapters/persistence/read-model-currency-catalog';
import { CurrencyCatalog } from '@ledger/shared/domain/value-objects/currency-catalog';
import { DataSource } from 'typeorm';

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
    // `ReferenceModule` hydrates the catalog on boot through this port instead
    // of the concrete adapter, so it no longer depends on a class another module
    // owns.
    { provide: CurrencyCatalogCache, useExisting: ReadModelCurrencyCatalog },
    { provide: EventStore, useClass: PostgresEventStore },
    { provide: ReadModelStore, useClass: PostgresReadModelStore },
    // Only the read ports Nest genuinely injects are bound here, and they come
    // from the same factory that composes the buses — binding them with
    // `useClass` would build a second adapter for a port that already has one,
    // and which instance answered would depend on how the caller got there.
    //
    // The other six used to be bound in their feature modules and nobody
    // injected them: editing those bindings changed nothing at all. They are
    // gone; `read-side-ports.factory` is the single root.
    {
      provide: SystemAccountLookup,
      inject: [ReadModelStore],
      useFactory: (readModel: ReadModelStore): SystemAccountLookup =>
        createWriteSideReadPorts(readModel).systemAccounts,
    },
    // Not part of `WriteSideReadPorts` — its only consumer is `EvaluateAssertion`,
    // composed by `ReconciliationModule`, so this is its one and only binding.
    { provide: LedgerTimezoneReader, useClass: ReadModelLedgerTimezoneReader },
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
    // register its handlers on the one bus the controllers ask through. The
    // SQL transaction finder is the substitution the real wiring needs (R7);
    // compositions without a DataSource — the e2e and in-memory ones — fall
    // back to the store-backed twin, proven identical by the shared contract.
    {
      provide: RegistryQueryBus,
      inject: [ReadModelStore, { token: getDataSourceToken(), optional: true }],
      useFactory: (readModel: ReadModelStore, dataSource: DataSource | undefined): RegistryQueryBus => {
        const ports = createQueryPorts(readModel);
        const composed = dataSource ? withSqlTransactionFinder(ports, dataSource) : ports;

        return createQueryBus(composed);
      },
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
    CurrencyCatalogCache,
    ReadModelCurrencyCatalog,
    Clock,
    IdGenerator,
    LedgerTimezoneReader,
    SystemAccountLookup,
  ],
})
export class LedgerCoreModule {}
