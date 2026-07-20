/**
 * Comparison a filter applies between a field and a value.
 *
 * The string values double as the public wire format: a REST caller writes
 * `filters[0][operator]=gte`. Keeping the enum free of ORM vocabulary is what
 * lets a criteria be honoured by any adapter, not just the TypeORM one.
 */
export enum FilterOperator {
  EQUAL = 'eq',
  NOT_EQUAL = 'ne',
  GREATER_THAN = 'gt',
  GREATER_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_OR_EQUAL = 'lte',
  /** Inclusive range; the value is a `[from, to]` pair. */
  BETWEEN = 'between',
  /** Case-insensitive substring match. */
  CONTAINS = 'contains',
  /**
   * Case-insensitive equality. Distinct from `CONTAINS`: resolving a category
   * by the name a provider sent must match the whole name, not any name that
   * happens to contain it.
   */
  EQUALS_IGNORE_CASE = 'ieq',
  /** Membership; the value is a non-empty list. */
  IN = 'in',
  IS_NULL = 'null',
  IS_NOT_NULL = 'notnull',
}

/** Operators whose value is a list rather than a scalar. */
export const LIST_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.IN,
  FilterOperator.BETWEEN,
];

/** Operators that take no value at all. */
export const VALUELESS_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.IS_NULL,
  FilterOperator.IS_NOT_NULL,
];
