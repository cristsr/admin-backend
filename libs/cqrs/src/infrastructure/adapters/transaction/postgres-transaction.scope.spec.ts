import { PostgresTransactionScope } from './postgres-transaction.scope';

describe('PostgresTransactionScope', () => {
  it('exposes the manager set by run() only inside the scope', async () => {
    const scope = new PostgresTransactionScope();
    const manager = { query: jest.fn() } as never;

    expect(scope.current()).toBeUndefined();

    await scope.run(manager, async () => {
      expect(scope.current()).toBe(manager);
    });

    expect(scope.current()).toBeUndefined();
  });

  it('keeps the outer manager when scopes nest', async () => {
    const scope = new PostgresTransactionScope();
    const outer = { query: jest.fn() } as never;
    const inner = { query: jest.fn() } as never;

    await scope.run(outer, async () => {
      await scope.run(inner, async () => {
        expect(scope.current()).toBe(outer);
      });
    });
  });
});
