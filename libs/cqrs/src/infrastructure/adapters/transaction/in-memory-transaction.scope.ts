import { AsyncLocalStorage } from 'node:async_hooks';

/** A store whose in-memory state can be snapshotted and restored atomically. */
export interface SnapshotableStore {
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

type ScopeState = {
  readonly snapshots: Map<SnapshotableStore, unknown>;
};

/**
 * Coordinates cross-store rollback for the in-memory adapters: a scope opened
 * with `rollback` snapshots every attached store (event store + read model)
 * and restores them when it resolves — a dry-run preview leaves no observable
 * effect (AC-3). A failed run always restores; a successful non-rollback run
 * commits. Nested runs join the outer scope.
 */
export class InMemoryTransactionScope {
  private readonly als = new AsyncLocalStorage<ScopeState>();
  private readonly stores = new Set<SnapshotableStore>();

  attach(store: SnapshotableStore): void {
    this.stores.add(store);
  }

  current(): ScopeState | undefined {
    return this.als.getStore();
  }

  async run<T>(work: () => Promise<T>, options?: { rollback?: boolean }): Promise<T> {
    const outer = this.als.getStore();

    if (outer) return work();

    const snapshots = new Map<SnapshotableStore, unknown>();
    for (const store of this.stores) snapshots.set(store, store.snapshot());

    return this.als.run({ snapshots }, async () => {
      try {
        const result = await work();
        if (options?.rollback) this.restore(snapshots);
        return result;
      } catch (error) {
        this.restore(snapshots);
        throw error;
      }
    });
  }

  private restore(snapshots: Map<SnapshotableStore, unknown>): void {
    for (const [store, snapshot] of snapshots) store.restore(snapshot);
  }
}
