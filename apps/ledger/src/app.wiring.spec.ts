/* eslint-disable import-x/order -- the environment must be set before anything under src is imported. */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { PolicyCommandBus } from '@cqrs/application/command-bus/command-bus';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { RegistryQueryBus } from '@cqrs/application/query-bus/query-bus';
import { AccountBalanceFinder } from '@ledger/accounts/application/ports/account-balance-finder.port';
import { AccountConstraintsReader } from '@ledger/accounts/application/ports/account-constraints-reader.port';
import { AccountNameReader } from '@ledger/accounts/application/ports/account-name-reader.port';
import { AccountTreeFinder } from '@ledger/accounts/application/ports/account-tree-finder.port';
import { createWriteSideReadPorts } from '@ledger/bootstrap/read-side-ports.factory';
import { LedgerSettingsFinder } from '@ledger/ledger/application/ports/ledger-settings-finder.port';
import { LedgerTimezoneReader } from '@ledger/ledger/application/ports/ledger-timezone-reader.port';
import { SystemAccountLookup } from '@ledger/ledger/application/ports/system-account-lookup.port';
import { CurrencyCatalogFinder } from '@ledger/reference/application/ports/currency-catalog-finder.port';

/** Every value the config validator demands; must be set before the modules load. */
const environment: Record<string, string> = {
  ENV: 'test',
  PORT: '3100',
  DB_TYPE: 'postgres',
  DB_URI: 'postgres://user:pass@localhost:5432/ledger_test',
  DB_SSL: 'false',
  DB_SYNCHRONIZE: 'false',
  SHOW_DOCS: 'false',
};

Object.assign(process.env, environment);

// Required, not imported: the config validator runs at module load and needs
// the env above set first.
const { AppModule } = require('./app.module');
const { DatabaseModule } = require('./database/database.module');

/**
 * Inert DataSource: `forFeature` providers only call `getRepository` on it,
 * so the app wires up without a database.
 */
const dataSource = {
  getRepository: () => ({}),
  getTreeRepository: () => ({}),
  createEntityManager: () => ({}),
  // Consulted to decide whether an entity is a tree entity; none here are.
  entityMetadatas: [],
  options: { type: 'postgres' },
  manager: {},
};

@Global()
@Module({
  providers: [
    { provide: getDataSourceToken(), useValue: dataSource },
    { provide: getEntityManagerToken(), useValue: dataSource.manager },
  ],
  exports: [getDataSourceToken(), getEntityManagerToken()],
})
class StubDatabaseModule {}

/**
 * Compiles the whole application graph with the database swapped out, so a
 * provider missing from a module fails here instead of at runtime.
 */
describe('Application wiring', () => {
  let moduleRef: TestingModule;

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('compiles the root module without a database connection', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(StubDatabaseModule)
      .compile();

    expect(moduleRef).toBeDefined();
  });

  it('boots the Nest application and closes it', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(StubDatabaseModule)
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    expect(app).toBeDefined();

    await app.close();
  });

  /**
   * Registration happens in two places — the core factory and each module's
   * `onModuleInit` — so a command can compile, own an endpoint, and still have
   * no handler on the bus. That failure only surfaces when a request arrives, so
   * it is pinned here against the command catalogue.
   */
  it('registers a handler for every command in the catalogue', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(StubDatabaseModule)
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const bus = app.get(PolicyCommandBus);

    // Names, not the constructors themselves, so a mismatch prints a readable
    // diff. Safe here because the test runner never minifies.
    const registered = bus
      .registeredTypes()
      .map((command) => command.name)
      .sort();

    // ChangePresentationCurrency + ChangeTimezone ship as one command
    // (ReplaceLedgerSettings).
    expect(registered).toEqual(
      [
        'AmendPendingTransactionCommand',
        'AnnotateTransactionCommand',
        'AssertBalanceCommand',
        'CloseAccountCommand',
        'ConfirmTransactionCommand',
        'InitializeLedgerCommand',
        'MergePendingTransfersCommand',
        'OpenAccountCommand',
        // Internal: no controller dispatches it. `InitializeLedger` does, so the
        // technical accounts are opened by the module that owns the aggregate.
        'OpenSystemAccountCommand',
        'RecordOpeningBalanceCommand',
        'RecordTransactionCommand',
        'RegisterCurrencyCommand',
        'RenameAccountCommand',
        'ReplaceLedgerSettingsCommand',
        'ResolveDiscrepancyCommand',
        'ReverseConfirmedTransactionCommand',
        'RevokeAssertionCommand',
        'VoidPendingTransactionCommand',
      ].sort(),
    );

    await app.close();
  });

  /**
   * Same failure mode on the read side, and the same reason to pin it: the two
   * reconciliation queries are registered by their module's `onModuleInit`, not
   * by `createQueryBus`, because their store is bound in that module. A read
   * that compiles and owns an endpoint can still reach no handler.
   */
  it('registers a handler for every query in the catalogue', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(StubDatabaseModule)
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const registered = app
      .get(RegistryQueryBus)
      .registeredTypes()
      .map((query) => query.name)
      .sort();

    expect(registered).toEqual(
      [
        'GetAccountBalancesQuery',
        'GetAccountByIdQuery',
        'GetAccountTreeQuery',
        'GetAssertionStatusQuery',
        'GetLedgerSettingsQuery',
        'GetTransactionByIdQuery',
        'ListAssertionsQuery',
        'ListCurrenciesQuery',
        'ListPendingReviewQuery',
        'ListTransactionsQuery',
      ].sort(),
    );

    await app.close();
  });

  /**
   * Read ports composed by `bootstrap/read-side-ports.factory`. That factory is
   * the single root: it feeds the query bus and every in-memory composition, so
   * a second binding in a Nest module is not a redundancy but a fork — two
   * adapters for one port, and which one answers depends on how the caller got
   * there.
   *
   * Six of them used to be bound in a module nobody injected from, which is the
   * worst shape of the bug: editing that binding changed nothing at all, and
   * nothing reported it.
   */
  const FACTORY_OWNED_PORTS = [
    AccountTreeFinder,
    AccountBalanceFinder,
    AccountConstraintsReader,
    AccountNameReader,
    CurrencyCatalogFinder,
    LedgerSettingsFinder,
  ] as const;

  /**
   * Ports still bound in both roots. Empty since `refactor-module-boundaries`:
   * every one of them is now chosen in exactly one place. Kept as the shape of
   * the debt rather than deleted — a port added here again is a regression that
   * should be argued for, not discovered.
   */
  const STILL_DOUBLE_BOUND: readonly unknown[] = [];

  it('does not bind in Nest the read ports the bootstrap factory composes', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(StubDatabaseModule)
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const forked = FACTORY_OWNED_PORTS.filter((token) => !STILL_DOUBLE_BOUND.includes(token)).filter(
      (token) => {
        try {
          return Boolean(app.get(token, { strict: false }));
        } catch {
          return false; // no provider: exactly what this asserts
        }
      },
    );

    expect(forked.map((token) => token.name)).toEqual([]);

    await app.close();
  });

  /**
   * The two ports Nest genuinely injects — `ReconciliationModule` resolves both.
   * They must resolve to the same adapter the factory builds, or the write side
   * and the reconciliation side disagree about what a system account is.
   */
  it('resolves the Nest-injected read ports to the factory adapter', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(StubDatabaseModule)
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const readModel = app.get(ReadModelStore);
    const { systemAccounts } = createWriteSideReadPorts(readModel);

    expect(app.get(SystemAccountLookup, { strict: false }).constructor).toBe(
      systemAccounts.constructor,
    );
    expect(app.get(LedgerTimezoneReader, { strict: false })).toBeDefined();

    await app.close();
  });
});
