/* eslint-disable import-x/order -- the environment must be set before anything under src is imported. */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';

/** Every value the config validator demands; must be set before the modules load. */
const environment: Record<string, string> = {
  ENV: 'test',
  PORT: '3100',
  DB_TYPE: 'postgres',
  DB_URI: 'postgres://user:pass@localhost:5432/ledger_test',
  DB_SSL: 'false',
  DB_SYNCHRONIZE: 'false',
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
});
