import { DataSource } from 'typeorm';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { describeReadModelStoreContract } from '@ledger/shared-kernel/infrastructure/testing/read-model-store.contract';
import { PostgresReadModelStore } from './postgres-read-model-store';

const runPgTests = !!process.env.RUN_PG_TESTS;
const testUri =
  process.env.DB_URI ?? 'postgres://postgres:postgres@localhost:5432/ledger_test';

if (runPgTests) {
  let dataSource: DataSource;

  const initialize = async (): Promise<void> => {
    dataSource = new DataSource({ type: 'postgres', url: testUri });
    await dataSource.initialize();

    const runner = dataSource.createQueryRunner();
    await runner.query('DROP TABLE IF EXISTS t, a, b CASCADE');
    await runner.query(`
      CREATE TABLE t (
        id    TEXT PRIMARY KEY,
        label TEXT,
        count INT,
        kind  TEXT,
        maybe TEXT,
        name  TEXT,
        age   INT,
        score INT,
        n     INT,
        v     TEXT
      )
    `);
    await runner.query('CREATE TABLE a (id TEXT PRIMARY KEY)');
    await runner.query('CREATE TABLE b (id TEXT PRIMARY KEY)');
    await runner.release();
  };

  const makeStore = async (): Promise<ReadModelStore> => {
    if (!dataSource?.isInitialized) await initialize();
    await dataSource.query('TRUNCATE t, a, b CASCADE');
    return new PostgresReadModelStore(dataSource);
  };

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describeReadModelStoreContract(makeStore);
} else {
  describe.skip('PostgresReadModelStore contract (set RUN_PG_TESTS=1 with a database)', () => {
    it('is skipped without a database', () => {
      expect(true).toBe(true);
    });
  });
}
