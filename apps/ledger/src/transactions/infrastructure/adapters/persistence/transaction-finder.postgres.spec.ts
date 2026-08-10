import { PostgresReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store';
import { PostgresTransactionScope } from '@cqrs/infrastructure/adapters/transaction/postgres-transaction.scope';
import { DataSource } from 'typeorm';
import { PostingRow, TransactionRow } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';
import { TransactionFinderFixture, runTransactionFinderContract } from '@ledger/transactions/infrastructure/testing/transaction-finder.contract';
import { PostgresTransactionFinder } from './postgres-transaction-finder';

/**
 * The same contract the in-memory spec runs, this time over the SQL adapter.
 * Needs a database with the core migration applied, so it only runs with
 * RUN_PG_TESTS=1 — same convention as the other Postgres specs.
 */
const runPgTests = !!process.env.RUN_PG_TESTS;
const testUri = process.env.DB_URI ?? 'postgres://postgres:postgres@localhost:5432/ledger_test';

if (runPgTests) {
  describe('PostgresTransactionFinder over a real database', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
      dataSource = new DataSource({ type: 'postgres', url: testUri });
      await dataSource.initialize();
    });

    afterAll(async () => {
      await dataSource?.destroy();
    });

    const fixture = async (): Promise<TransactionFinderFixture> => {
      const store = new PostgresReadModelStore(dataSource, new PostgresTransactionScope());
      await dataSource.query('TRUNCATE proj_transactions, proj_postings CASCADE');

      const seed = async (
        row: TransactionRow,
        postings: readonly PostingRow[] = [],
      ): Promise<void> => {
        await store.upsert(
          'proj_transactions',
          { transaction_id: row.transaction_id },
          row as unknown as Record<string, unknown>,
        );
        for (const posting of postings) {
          await store.upsert(
            'proj_postings',
            { posting_id: posting.posting_id },
            posting as unknown as Record<string, unknown>,
          );
        }
      };

      return { finder: new PostgresTransactionFinder(dataSource), seed };
    };

    runTransactionFinderContract(fixture);
  });
} else {
  describe.skip('PostgresTransactionFinder (set RUN_PG_TESTS=1 with a database)', () => {
    it('is skipped without a database', () => {
      expect(true).toBe(true);
    });
  });
}
