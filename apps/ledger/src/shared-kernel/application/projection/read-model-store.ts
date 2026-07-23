import { Criteria } from '@shared';

/** The primary-key columns identifying one read-model row. */
export type ReadModelKey = Readonly<Record<string, string>>;

/** A denormalized read-model row. Values are already storage-shaped. */
export type ReadModelRow = Readonly<Record<string, unknown>>;

/**
 * Read-model persistence port (RNF-10): no business logic, and only projectors
 * write to it. Queries reuse the shared {@link Criteria}. `truncate` supports
 * full projection rebuilds (RNF-5).
 */
export abstract class ReadModelStore {
  abstract upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>;

  abstract delete(table: string, key: ReadModelKey): Promise<void>;

  abstract query<TRow>(table: string, criteria: Criteria): Promise<TRow[]>;

  abstract truncate(table: string): Promise<void>;
}
