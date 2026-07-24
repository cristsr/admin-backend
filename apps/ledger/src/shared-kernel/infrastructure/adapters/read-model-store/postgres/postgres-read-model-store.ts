import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Criteria, Filter, FilterOperator } from '@shared';
import {
  ReadModelKey,
  ReadModelRow,
  ReadModelStore,
} from '@ledger/shared-kernel/application/projection/read-model-store';

/**
 * PostgreSQL {@link ReadModelStore} implementation.
 * Projectors upsert denormalized rows; queries use Criteria or raw SQL.
 */
@Injectable()
export class PostgresReadModelStore extends ReadModelStore {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void> {
    const cols = Object.keys(row);
    const values = Object.values(row);
    const keyCols = Object.keys(key);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const updateCols = cols.filter((c) => !keyCols.includes(c));

    const conflictClause =
      keyCols.length > 0 && updateCols.length > 0
        ? `ON CONFLICT (${keyCols.join(', ')}) DO UPDATE SET ${updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`
        : 'ON CONFLICT DO NOTHING';

    const sql = `
      INSERT INTO ${table} (${cols.join(', ')})
      VALUES (${placeholders})
      ${conflictClause}
    `;

    await this.dataSource.query(sql, values);
  }

  async delete(table: string, key: ReadModelKey): Promise<void> {
    const keys = Object.keys(key);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
    const values = Object.values(key);

    const sql = `DELETE FROM ${table} WHERE ${conditions}`;
    await this.dataSource.query(sql, values);
  }

  async query<TRow>(table: string, criteria: Criteria): Promise<TRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const filter of criteria.filters) {
      const { sql, value } = this.buildFilterSql(filter, paramIndex);
      conditions.push(sql);
      if (value !== undefined) {
        params.push(value);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderClause = criteria.hasOrders
      ? `ORDER BY ${criteria.orders.map((o) => `${o.field} ${o.type}`).join(', ')}`
      : '';

    const limitClause = criteria.isPaginated
      ? `LIMIT ${criteria.pagination?.take} OFFSET ${criteria.pagination?.skip}`
      : '';

    const sql = `SELECT * FROM ${table} ${whereClause} ${orderClause} ${limitClause}`;
    return this.dataSource.query(sql, params);
  }

  async truncate(table: string): Promise<void> {
    await this.dataSource.query(`TRUNCATE TABLE ${table} CASCADE`);
  }

  /**
   * Convenience method for raw SQL queries (used by handlers).
   */
  async queryRaw<TRow>(sql: string, params?: unknown[]): Promise<TRow[]> {
    return this.dataSource.query(sql, params || []);
  }

  /**
   * Convenience method for single-row raw SQL queries.
   */
  async queryOneRaw<TRow>(sql: string, params?: unknown[]): Promise<TRow | null> {
    const rows = await this.queryRaw<TRow>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  private buildFilterSql(filter: Filter, paramIndex: number): { sql: string; value?: unknown } {
    switch (filter.operator) {
      case FilterOperator.EQUAL:
        return { sql: `${filter.field} = $${paramIndex}`, value: filter.value };
      case FilterOperator.NOT_EQUAL:
        return { sql: `${filter.field} != $${paramIndex}`, value: filter.value };
      case FilterOperator.IN:
        return {
          sql: `${filter.field} IN (${filter.values.map((_, i) => `$${paramIndex + i}`).join(', ')})`,
          value: undefined,
        };
      case FilterOperator.IS_NULL:
        return { sql: `${filter.field} IS NULL` };
      case FilterOperator.IS_NOT_NULL:
        return { sql: `${filter.field} IS NOT NULL` };
      case FilterOperator.CONTAINS:
        return { sql: `${filter.field} ILIKE $${paramIndex}`, value: `%${filter.value}%` };
      case FilterOperator.EQUALS_IGNORE_CASE:
        return { sql: `LOWER(${filter.field}) = LOWER($${paramIndex})`, value: filter.value };
      case FilterOperator.GREATER_THAN:
        return { sql: `${filter.field} > $${paramIndex}`, value: filter.value };
      case FilterOperator.GREATER_OR_EQUAL:
        return { sql: `${filter.field} >= $${paramIndex}`, value: filter.value };
      case FilterOperator.LESS_THAN:
        return { sql: `${filter.field} < $${paramIndex}`, value: filter.value };
      case FilterOperator.LESS_OR_EQUAL:
        return { sql: `${filter.field} <= $${paramIndex}`, value: filter.value };
      case FilterOperator.BETWEEN:
        return {
          sql: `${filter.field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
          value: undefined,
        };
      default:
        return { sql: '1=1' };
    }
  }
}
