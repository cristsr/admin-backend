import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { PROJ_PENDING_REVIEW } from '@ledger/transactions/infrastructure/projections/pending-review.schema';
import { ReadModelPendingReviewFinder } from './read-model-pending-review-finder';

const row = {
  user_id: 'user-1',
  date: '2026-07-20',
  occurred_at: '2026-07-20T10:00:00.000Z',
  payee: 'Bakery',
  description: 'Bread',
  posting_count: 2,
  client_id: 'client-1',
  external_ref: null,
};

async function finderWith(
  rows: readonly { user_id: string; date: string }[],
): Promise<ReadModelPendingReviewFinder> {
  const store = new InMemoryReadModelStore();

  for (const [index, { user_id, date }] of rows.entries()) {
    await store.upsert(
      PROJ_PENDING_REVIEW,
      { transaction_id: `tx-${index}` },
      { ...row, user_id, date, transaction_id: `tx-${index}` },
    );
  }

  return new ReadModelPendingReviewFinder(store);
}

describe('ReadModelPendingReviewFinder', () => {
  it('serves the inbox oldest first', async () => {
    const finder = await finderWith([
      { user_id: 'user-1', date: '2026-07-21' },
      { user_id: 'user-1', date: '2026-07-20' },
    ]);

    const rows = await finder.list('user-1', { limit: 10, offset: 0 });

    expect(rows.map((r) => r.date)).toEqual(['2026-07-20', '2026-07-21']);
  });

  it('scopes the inbox to the user', async () => {
    const finder = await finderWith([
      { user_id: 'user-1', date: '2026-07-20' },
      { user_id: 'user-2', date: '2026-07-21' },
    ]);

    const rows = await finder.list('user-1', { limit: 10, offset: 0 });

    expect(rows.map((r) => r.clientId)).toEqual(['client-1']);
  });

  it('paginates with the requested page size', async () => {
    const finder = await finderWith([
      { user_id: 'user-1', date: '2026-07-20' },
      { user_id: 'user-1', date: '2026-07-21' },
      { user_id: 'user-1', date: '2026-07-22' },
    ]);

    const rows = await finder.list('user-1', { limit: 2, offset: 0 });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.date)).toEqual(['2026-07-20', '2026-07-21']);
  });

  it('coerces the posting count from the stored text (Postgres returns it as a string)', async () => {
    const store = new InMemoryReadModelStore();
    await store.upsert(
      PROJ_PENDING_REVIEW,
      { transaction_id: 'tx-1' },
      { ...row, transaction_id: 'tx-1', posting_count: '2' },
    );
    const finder = new ReadModelPendingReviewFinder(store);

    const [entry] = await finder.list('user-1', { limit: 10, offset: 0 });

    expect(entry.postingCount).toBe(2);
  });
});
