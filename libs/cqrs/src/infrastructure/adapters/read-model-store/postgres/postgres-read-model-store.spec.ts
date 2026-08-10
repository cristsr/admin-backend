import { DataSource, EntityManager } from 'typeorm';
import { PostgresTransactionScope } from '../../transaction/postgres-transaction.scope';
import { PostgresReadModelStore } from './postgres-read-model-store';

describe('PostgresReadModelStore (transaction scope)', () => {
  const dataSource = { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource;

  it('routes writes through the scoped manager when a transaction is open', async () => {
    const scope = new PostgresTransactionScope();
    const store = new PostgresReadModelStore(dataSource, scope);
    const manager = { query: jest.fn().mockResolvedValue([]) } as unknown as EntityManager;

    await scope.run(manager, async () => {
      await store.upsert('proj_t', { id: '1' }, { name: 'x' });
    });

    expect(manager.query).toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('uses the data source directly when no transaction is open', async () => {
    const scope = new PostgresTransactionScope();
    const store = new PostgresReadModelStore(dataSource, scope);

    await store.upsert('proj_t', { id: '1' }, { name: 'x' });

    expect(dataSource.query).toHaveBeenCalled();
  });
});
