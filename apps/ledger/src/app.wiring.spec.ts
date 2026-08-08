/* eslint-disable import-x/order -- the environment must be set before anything under src is imported. */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { PolicyCommandBus } from '@cqrs/application/command-bus/command-bus';

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
});
