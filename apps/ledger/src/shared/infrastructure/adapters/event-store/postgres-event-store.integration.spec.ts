import { EventStore } from '@cqrs/domain/ports/event-store';
import { PostgresEventStore } from '@cqrs/infrastructure/adapters/event-store/postgres/postgres-event-store';
import { CreateEventStore1790000000001 } from '@cqrs/infrastructure/adapters/migrations/1790000000001-CreateEventStore';
import { describeEventStoreContract } from '@cqrs/infrastructure/testing/event-store.contract';
import { DataSource } from 'typeorm';

/**
 * Runs the shared EventStore contract against a real PostgreSQL, plus the
 * append-only trigger checks. Gated on RUN_PG_TESTS so the suite stays green
 * without a database; provide DB_URI (or the default test URI) and RUN_PG_TESTS=1
 * to exercise it. The adapter must satisfy the identical contract (RNF-11).
 */
const runPgTests = !!process.env.RUN_PG_TESTS;
const testUri =
  process.env.DB_URI ?? 'postgres://postgres:postgres@localhost:5432/ledger_test';

if (runPgTests) {
  let dataSource: DataSource;

  const initialize = async (): Promise<void> => {
    dataSource = new DataSource({ type: 'postgres', url: testUri });
    await dataSource.initialize();

    const runner = dataSource.createQueryRunner();
    await runner.query('DROP TABLE IF EXISTS event_store CASCADE');
    await new CreateEventStore1790000000001().up(runner);
    await runner.release();
  };

  const makeStore = async (): Promise<EventStore> => {
    if (!dataSource?.isInitialized) await initialize();
    await dataSource.query('TRUNCATE event_store RESTART IDENTITY');

    return new PostgresEventStore(dataSource);
  };

  afterAll(async () => {
    await dataSource?.destroy();
  });

  describeEventStoreContract(makeStore);

  describe('PostgresEventStore append-only trigger (INV-12)', () => {
    it('rejects UPDATE and DELETE on event_store', async () => {
      await makeStore();
      await dataSource.query(
        `INSERT INTO event_store
           (event_id, user_id, aggregate_type, aggregate_id, sequence, event_type,
            client_id, payload, occurred_at, recorded_at)
         VALUES (gen_random_uuid(), gen_random_uuid(), 'Thing', gen_random_uuid(), 1,
            'ThingHappened', 'c', '{}', now(), now())`,
      );

      await expect(dataSource.query('UPDATE event_store SET client_id = $1', ['x'])).rejects.toThrow(
        /append-only/,
      );
      await expect(dataSource.query('DELETE FROM event_store')).rejects.toThrow(/append-only/);
    });
  });
} else {
  describe.skip('PostgresEventStore contract (set RUN_PG_TESTS=1 with a database)', () => {
    it('is skipped without a database', () => {
      expect(true).toBe(true);
    });
  });
}
