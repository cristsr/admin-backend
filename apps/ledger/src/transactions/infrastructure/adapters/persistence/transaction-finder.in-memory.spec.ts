import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PostingRow, TransactionRow } from '@ledger/transactions/infrastructure/projections/transaction-list.schema';
import { TransactionFinderFixture, runTransactionFinderContract } from '@ledger/transactions/infrastructure/testing/transaction-finder.contract';
import { ReadModelTransactionFinder } from './read-model-transaction-finder';

/**
 * The same contract the Postgres spec runs, this time over the in-memory twin
 * (`ReadModelStore`). Both adapters must prove identical behaviour — this is
 * what makes the in-memory compositions (AC-9) trustworthy substitutes.
 */
describe('ReadModelTransactionFinder over InMemoryReadModelStore', () => {
  const fixture = async (): Promise<TransactionFinderFixture> => {
    const store = new InMemoryReadModelStore();

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

    return { finder: new ReadModelTransactionFinder(store), seed };
  };

  runTransactionFinderContract(fixture);
});
