/* eslint-disable import-x/order -- the environment must be set before anything under src is imported. */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';

/** Every value the config validator demands; must be set before the modules load. */
const environment: Record<string, string> = {
  ENV: 'test',
  PORT: '3000',
  DB_TYPE: 'postgres',
  DB_URI: 'postgres://user:pass@localhost:5432/test',
  DB_SSL: 'false',
  DB_SYNCHRONIZE: 'false',
  SHOW_DOCS: 'false',
  OIDC_ISSUER: 'https://issuer.test/realms/test',
  OIDC_AUDIENCE: 'finances',
  AUTH_IDENTITY_PROVIDER: 'keycloak',
  USERS_API_URL: 'https://users.test',
  WEBHOOK_API_KEY: 'test-key',
  EXCHANGE_RATES_URL: 'https://rates.test',
};

Object.assign(process.env, environment);

// Required, not imported: the config validator runs at module load and needs
// the env above set first.
const { AppModule } = require('./app.module');
const { BudgetSpendingService } = require('./budget/domain/budget');
const {
  CategorizationService,
  CategoryResolver,
} = require('./categorization-rule/domain/categorization-rule');
const { DatabaseModule } = require('./database/database.module');
const {
  SaveMovementUsecase,
  UpdateMovementUsecase,
} = require('./movement/application/usecases');
const { CreateTransferUsecase } = require('./transfer/application/usecases');
const { TransferFactory } = require('./transfer/domain');
const {
  ReceiveWebhookTransactionUsecase,
} = require('./webhook/application/usecases');

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

  afterAll(async () => {
    await moduleRef?.close();
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(StubDatabaseModule)
      .compile();
  });

  it('resolves every provider in the dependency graph', () => {
    expect(moduleRef).toBeDefined();
  });

  it.each([
    ['BudgetSpendingService', BudgetSpendingService],
    ['CategorizationService', CategorizationService],
    ['CategoryResolver', CategoryResolver],
    ['TransferFactory', TransferFactory],
  ])('provides the %s domain service', (_name, token) => {
    expect(moduleRef.get(token, { strict: false })).toBeInstanceOf(token);
  });

  it.each([
    ['CreateTransferUsecase', CreateTransferUsecase],
    ['SaveMovementUsecase', SaveMovementUsecase],
    ['UpdateMovementUsecase', UpdateMovementUsecase],
    ['ReceiveWebhookTransactionUsecase', ReceiveWebhookTransactionUsecase],
  ])('injects the collaborators of %s', (_name, token) => {
    expect(moduleRef.get(token, { strict: false })).toBeInstanceOf(token);
  });
});
