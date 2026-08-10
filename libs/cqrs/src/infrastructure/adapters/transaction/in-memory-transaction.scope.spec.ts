import { InMemoryTransactionScope } from './in-memory-transaction.scope';

describe('InMemoryTransactionScope', () => {
  it('restores attached stores when the scope resolves with rollback', async () => {
    const scope = new InMemoryTransactionScope();
    const store = {
      snapshot: jest.fn(() => 'snap'),
      restore: jest.fn(),
    };

    scope.attach(store);

    await scope.run(async () => undefined, { rollback: true });

    expect(store.snapshot).toHaveBeenCalledTimes(1);
    expect(store.restore).toHaveBeenCalledWith('snap');
  });

  it('does not restore on a committed (non-rollback) run', async () => {
    const scope = new InMemoryTransactionScope();
    const store = { snapshot: jest.fn(() => 'snap'), restore: jest.fn() };

    scope.attach(store);
    await scope.run(async () => undefined);

    expect(store.restore).not.toHaveBeenCalled();
  });

  it('restores on failure even without the rollback flag', async () => {
    const scope = new InMemoryTransactionScope();
    const store = { snapshot: jest.fn(() => 'snap'), restore: jest.fn() };

    scope.attach(store);

    await expect(scope.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(store.restore).toHaveBeenCalledWith('snap');
  });

  it('joins an outer scope instead of nesting', async () => {
    const scope = new InMemoryTransactionScope();
    const store = { snapshot: jest.fn(() => 'snap'), restore: jest.fn() };

    scope.attach(store);

    await scope.run(async () => {
      await scope.run(async () => undefined, { rollback: true });
    });

    expect(store.snapshot).toHaveBeenCalledTimes(1);
    expect(store.restore).not.toHaveBeenCalled();
  });
});
