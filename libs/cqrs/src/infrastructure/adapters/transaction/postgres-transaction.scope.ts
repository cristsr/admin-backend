import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager } from 'typeorm';

/**
 * Shared transaction carrier for the PostgreSQL adapters. The event store opens
 * the scope around a command's unit of work; the read model store routes its
 * writes through the same scoped manager, so synchronous projections join the
 * command transaction (AC-2: a dry-run rollback reverts them too).
 */
export class PostgresTransactionScope {
  private readonly als = new AsyncLocalStorage<EntityManager>();

  run<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    if (this.als.getStore()) return work(); // an inner call joins the outer scope

    return this.als.run(manager, work);
  }

  current(): EntityManager | undefined {
    return this.als.getStore();
  }
}
