import { Criteria } from '@shared';
import { InMemoryEventStore } from '../../event-store/in-memory/in-memory-event-store';
import { InMemoryTransactionScope } from '../../transaction/in-memory-transaction.scope';
import { InMemoryReadModelStore } from './in-memory-read-model-store';

describe('InMemoryReadModelStore (transaction scope)', () => {
  it('reverts upserts when the shared scope rolls back (AC-3)', async () => {
    const scope = new InMemoryTransactionScope();
    const eventStore = new InMemoryEventStore(scope);
    const readModel = new InMemoryReadModelStore(scope);

    await eventStore.withTransaction(
      async () => {
        await readModel.upsert('proj_t', { id: '1' }, { name: 'x' });
      },
      { rollback: true },
    );

    expect(await readModel.query('proj_t', Criteria.none())).toEqual([]);
  });

  it('keeps upserts when the scope commits', async () => {
    const scope = new InMemoryTransactionScope();
    const eventStore = new InMemoryEventStore(scope);
    const readModel = new InMemoryReadModelStore(scope);

    await eventStore.withTransaction(async () => {
      await readModel.upsert('proj_t', { id: '1' }, { name: 'x' });
    });

    expect(await readModel.query('proj_t', Criteria.none())).toHaveLength(1);
  });
});
