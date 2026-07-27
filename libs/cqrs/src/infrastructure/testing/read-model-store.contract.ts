import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { Criteria, OrderType } from '@shared';

export type MakeReadModelStore = () => Promise<ReadModelStore>;

export function describeReadModelStoreContract(
  makeStore: MakeReadModelStore,
  teardown?: () => Promise<void>,
): void {
  describe('ReadModelStore contract', () => {
    let store: ReadModelStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    afterEach(async () => {
      await teardown?.();
    });

    it('upserts a new row and queries it by EQUAL', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', label: 'A', count: 10 });

      const rows = await store.query('t', Criteria.none().equals('id', '1'));

      expect(rows).toEqual([{ id: '1', label: 'A', count: 10 }]);
    });

    it('overwrites a row on repeated upsert with the same key (idempotent projection)', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', v: 'old' });
      await store.upsert('t', { id: '1' }, { id: '1', v: 'new' });

      const rows = await store.query('t', Criteria.none());

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: '1', v: 'new' });
    });

    it('isolates tables — upsert in one table does not appear in another', async () => {
      await store.upsert('a', { id: '1' }, { id: '1' });
      await store.upsert('b', { id: '1' }, { id: '2' });

      expect(await store.query('a', Criteria.none())).toHaveLength(1);
      expect(await store.query('b', Criteria.none())).toHaveLength(1);
    });

    it('deletes a row by key', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.delete('t', { id: '1' });

      const rows = await store.query('t', Criteria.none());

      expect(rows).toEqual([{ id: '2' }]);
    });

    it('delete on a non-existent key is a no-op', async () => {
      await store.delete('t', { id: 'ghost' });

      expect(await store.query('t', Criteria.none())).toEqual([]);
    });

    it('queries by NOT_EQUAL', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', kind: 'A' });
      await store.upsert('t', { id: '2' }, { id: '2', kind: 'B' });
      await store.upsert('t', { id: '3' }, { id: '3', kind: 'A' });

      const rows = await store.query(
        't',
        Criteria.none().equals('kind', 'A').notEquals('id', '1'),
      );

      expect(rows.map((r) => (r as Record<string, unknown>).id)).toEqual(['3']);
    });

    it('queries by IN matching a subset of rows', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', kind: 'A' });
      await store.upsert('t', { id: '2' }, { id: '2', kind: 'B' });
      await store.upsert('t', { id: '3' }, { id: '3', kind: 'A' });

      const rows = await store.query('t', Criteria.none().oneOf('kind', ['A']));

      expect(rows).toHaveLength(2);
    });

    it('queries by IS_NULL and IS_NOT_NULL', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', maybe: null });
      await store.upsert('t', { id: '2' }, { id: '2', maybe: 'present' });

      const nulls = await store.query('t', Criteria.none().isNull('maybe'));

      expect(nulls.map((r) => (r as Record<string, unknown>).id)).toEqual(['1']);

      const notNulls = await store.query('t', Criteria.none().isNotNull('maybe'));

      expect(notNulls.map((r) => (r as Record<string, unknown>).id)).toEqual(['2']);
    });

    it('queries by CONTAINS (case-insensitive)', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', name: 'Hello World' });
      await store.upsert('t', { id: '2' }, { id: '2', name: 'Farewell' });

      const rows = await store.query('t', Criteria.none().contains('name', 'hello'));

      expect(rows.map((r) => (r as Record<string, unknown>).id)).toEqual(['1']);
    });

    it('queries by GREATER_THAN', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', age: 10 });
      await store.upsert('t', { id: '2' }, { id: '2', age: 30 });
      await store.upsert('t', { id: '3' }, { id: '3', age: 20 });

      const rows = await store.query('t', Criteria.none().greaterThan('age', 15));

      expect(rows.map((r) => (r as Record<string, unknown>).id)).toEqual(['2', '3']);
    });

    it('queries by BETWEEN', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', score: 5 });
      await store.upsert('t', { id: '2' }, { id: '2', score: 10 });
      await store.upsert('t', { id: '3' }, { id: '3', score: 15 });
      await store.upsert('t', { id: '4' }, { id: '4', score: 20 });

      const rows = await store.query('t', Criteria.none().between('score', 10, 15));

      expect(rows.map((r) => (r as Record<string, unknown>).id)).toEqual(['2', '3']);
    });

    it('orders ASC and DESC', async () => {
      await store.upsert('t', { id: '1' }, { id: '1', n: 3 });
      await store.upsert('t', { id: '2' }, { id: '2', n: 1 });
      await store.upsert('t', { id: '3' }, { id: '3', n: 2 });

      const asc = await store.query('t', Criteria.none().orderBy('n', OrderType.ASC));

      expect(asc.map((r) => (r as Record<string, unknown>).n)).toEqual([1, 2, 3]);

      const desc = await store.query('t', Criteria.none().orderBy('n', OrderType.DESC));

      expect(desc.map((r) => (r as Record<string, unknown>).n)).toEqual([3, 2, 1]);
    });

    it('paginates with limitTo (sets take)', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.upsert('t', { id: '3' }, { id: '3' });
      await store.upsert('t', { id: '4' }, { id: '4' });

      const rows = await store.query('t', Criteria.none().limitTo(2));

      expect(rows).toHaveLength(2);
    });

    it('paginates with skip + take', async () => {
      await store.upsert('t', { id: 'a' }, { id: 'a', n: 1 });
      await store.upsert('t', { id: 'b' }, { id: 'b', n: 2 });
      await store.upsert('t', { id: 'c' }, { id: 'c', n: 3 });
      await store.upsert('t', { id: 'd' }, { id: 'd', n: 4 });

      const rows = await store.query(
        't',
        Criteria.none().orderBy('n', OrderType.ASC).paginate({ offset: 1, limit: 2 }),
      );

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => (r as Record<string, unknown>).n)).toEqual([2, 3]);
    });

    it('returns all rows with empty Criteria', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.upsert('t', { id: '3' }, { id: '3' });

      expect(await store.query('t', Criteria.none())).toHaveLength(3);
    });

    it('truncates all rows from a table', async () => {
      await store.upsert('t', { id: '1' }, { id: '1' });
      await store.upsert('t', { id: '2' }, { id: '2' });
      await store.truncate('t');

      expect(await store.query('t', Criteria.none())).toEqual([]);
    });

    it('truncate of one table does not affect another', async () => {
      await store.upsert('a', { id: '1' }, { id: '1' });
      await store.upsert('b', { id: '2' }, { id: '2' });
      await store.truncate('a');

      expect(await store.query('a', Criteria.none())).toEqual([]);
      expect(await store.query('b', Criteria.none())).toHaveLength(1);
    });
  });
}
