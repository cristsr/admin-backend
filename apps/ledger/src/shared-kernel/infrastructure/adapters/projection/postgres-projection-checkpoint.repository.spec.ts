import { DataSource } from 'typeorm';
import { PostgresProjectionCheckpointRepository } from './postgres-projection-checkpoint.repository';

/**
 * Runs against a real database only when RUN_PG_TESTS=1, mirroring
 * `postgres-read-model-store.spec.ts`. The repository's semantics are also
 * covered without a database by the in-memory double's usage across the
 * rebuilder and pump specs.
 */
const runPgTests = !!process.env.RUN_PG_TESTS;
const testUri = process.env.DB_URI ?? 'postgres://postgres:postgres@localhost:5432/ledger_test';

if (runPgTests) {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({ type: 'postgres', url: testUri });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE projection_checkpoints');
  });

  describe('PostgresProjectionCheckpointRepository', () => {
    it('returns 0 for a projection that never ran', async () => {
      const repository = new PostgresProjectionCheckpointRepository(dataSource);

      expect(await repository.lastPosition('reconciliation')).toBe(0n);
    });

    it('persists a position and reads it back as bigint', async () => {
      const repository = new PostgresProjectionCheckpointRepository(dataSource);
      await repository.advance('reconciliation', 42n);

      expect(await repository.lastPosition('reconciliation')).toBe(42n);
    });

    it('advances an existing checkpoint instead of inserting a second row', async () => {
      const repository = new PostgresProjectionCheckpointRepository(dataSource);
      await repository.advance('reconciliation', 10n);
      await repository.advance('reconciliation', 20n);

      expect(await repository.lastPosition('reconciliation')).toBe(20n);
    });

    it('keeps projections independent', async () => {
      const repository = new PostgresProjectionCheckpointRepository(dataSource);
      await repository.advance('reconciliation', 10n);
      await repository.advance('account_tree', 99n);

      expect(await repository.lastPosition('reconciliation')).toBe(10n);
      expect(await repository.lastPosition('account_tree')).toBe(99n);
    });

    it('survives positions beyond Number.MAX_SAFE_INTEGER', async () => {
      const repository = new PostgresProjectionCheckpointRepository(dataSource);
      const huge = 9007199254740993n; // MAX_SAFE_INTEGER + 2

      await repository.advance('reconciliation', huge);

      expect(await repository.lastPosition('reconciliation')).toBe(huge);
    });
  });
} else {
  describe.skip('PostgresProjectionCheckpointRepository (set RUN_PG_TESTS=1 with a database)', () => {
    it('is skipped without a database', () => {
      expect(true).toBe(true);
    });
  });
}
