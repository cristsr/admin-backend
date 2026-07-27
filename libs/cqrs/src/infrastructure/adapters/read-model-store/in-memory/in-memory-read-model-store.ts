import {
  ReadModelKey,
  ReadModelRow,
  ReadModelStore,
} from '@cqrs/application/projection/read-model-store';
import { Criteria, Filter, FilterOperator, OrderType } from '@shared';

/**
 * In-memory {@link ReadModelStore} for testing the full read side without a
 * database (RNF-11). Rows live in a per-table map keyed by their primary key;
 * queries evaluate the shared {@link Criteria} in process.
 */
export class InMemoryReadModelStore extends ReadModelStore {
  private readonly tables = new Map<string, Map<string, ReadModelRow>>();

  async upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void> {
    this.tableOf(table).set(this.keyOf(key), row);
  }

  async delete(table: string, key: ReadModelKey): Promise<void> {
    this.tableOf(table).delete(this.keyOf(key));
  }

  async truncate(table: string): Promise<void> {
    this.tableOf(table).clear();
  }

  async query<TRow>(table: string, criteria: Criteria): Promise<TRow[]> {
    const rows = [...this.tableOf(table).values()].filter((row) =>
      criteria.filters.every((filter) => this.matches(row, filter)),
    );

    const ordered = this.applyOrders(rows, criteria);

    return this.applyPagination(ordered, criteria) as TRow[];
  }

  private tableOf(table: string): Map<string, ReadModelRow> {
    const existing = this.tables.get(table);

    if (existing) return existing;

    const created = new Map<string, ReadModelRow>();
    this.tables.set(table, created);

    return created;
  }

  private keyOf(key: ReadModelKey): string {
    return Object.keys(key)
      .sort()
      .map((column) => `${column}=${key[column]}`)
      .join('|');
  }

  private matches(row: ReadModelRow, filter: Filter): boolean {
    const value = row[filter.field];

    switch (filter.operator) {
      case FilterOperator.EQUAL:
        return value === filter.value;
      case FilterOperator.NOT_EQUAL:
        return value !== filter.value;
      case FilterOperator.IN:
        return filter.values.includes(value as never);
      case FilterOperator.IS_NULL:
        return value === null || value === undefined;
      case FilterOperator.IS_NOT_NULL:
        return value !== null && value !== undefined;
      case FilterOperator.CONTAINS:
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case FilterOperator.EQUALS_IGNORE_CASE:
        return String(value).toLowerCase() === String(filter.value).toLowerCase();
      case FilterOperator.GREATER_THAN:
        return (value as never) > (filter.value as never);
      case FilterOperator.GREATER_OR_EQUAL:
        return (value as never) >= (filter.value as never);
      case FilterOperator.LESS_THAN:
        return (value as never) < (filter.value as never);
      case FilterOperator.LESS_OR_EQUAL:
        return (value as never) <= (filter.value as never);
      case FilterOperator.BETWEEN: {
        const [from, to] = filter.values;

        return (value as never) >= (from as never) && (value as never) <= (to as never);
      }
      default:
        return false;
    }
  }

  private applyOrders(rows: readonly ReadModelRow[], criteria: Criteria): ReadModelRow[] {
    if (!criteria.hasOrders) return [...rows];

    return [...rows].sort((left, right) => {
      for (const order of criteria.orders) {
        const a = left[order.field];
        const b = right[order.field];

        if (a === b) continue;

        const direction = order.type === OrderType.DESC ? -1 : 1;

        return ((a as never) < (b as never) ? -1 : 1) * direction;
      }

      return 0;
    });
  }

  private applyPagination(rows: readonly ReadModelRow[], criteria: Criteria): ReadModelRow[] {
    if (!criteria.isPaginated) return [...rows];

    const { skip, take } = criteria.pagination as { skip: number; take: number };

    return rows.slice(skip, skip + take);
  }
}
