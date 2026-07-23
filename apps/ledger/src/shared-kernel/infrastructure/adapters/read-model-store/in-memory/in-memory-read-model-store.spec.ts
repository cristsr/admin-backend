import { Criteria, OrderType } from '@shared';
import { InMemoryReadModelStore } from './in-memory-read-model-store';

describe('InMemoryReadModelStore', () => {
  let store: InMemoryReadModelStore;

  beforeEach(() => {
    store = new InMemoryReadModelStore();
  });

  it('upserts and queries by equality', async () => {
    await store.upsert('proj_accounts', { account_id: 'a1' }, { account_id: 'a1', type: 'ASSETS' });

    const rows = await store.query('proj_accounts', Criteria.none().equals('type', 'ASSETS'));

    expect(rows).toEqual([{ account_id: 'a1', type: 'ASSETS' }]);
  });

  it('overwrites a row on repeated upsert with the same key (idempotent projection)', async () => {
    await store.upsert('proj_accounts', { account_id: 'a1' }, { account_id: 'a1', name: 'Old' });
    await store.upsert('proj_accounts', { account_id: 'a1' }, { account_id: 'a1', name: 'New' });

    const rows = await store.query('proj_accounts', Criteria.none());

    expect(rows).toEqual([{ account_id: 'a1', name: 'New' }]);
  });

  it('deletes by key', async () => {
    await store.upsert('t', { id: '1' }, { id: '1' });
    await store.delete('t', { id: '1' });

    expect(await store.query('t', Criteria.none())).toEqual([]);
  });

  it('orders and paginates', async () => {
    await store.upsert('t', { id: '1' }, { id: '1', n: 3 });
    await store.upsert('t', { id: '2' }, { id: '2', n: 1 });
    await store.upsert('t', { id: '3' }, { id: '3', n: 2 });

    const rows = await store.query<{ n: number }>(
      't',
      Criteria.none().orderBy('n', OrderType.ASC).limitTo(2),
    );

    expect(rows.map((r) => r.n)).toEqual([1, 2]);
  });

  it('truncates a table for rebuild', async () => {
    await store.upsert('t', { id: '1' }, { id: '1' });
    await store.truncate('t');

    expect(await store.query('t', Criteria.none())).toEqual([]);
  });
});
