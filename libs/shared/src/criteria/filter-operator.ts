/**
 * Comparison a filter applies. The string values are the public wire format
 * (`filters[0][operator]=gte`), free of ORM vocabulary.
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
  /** Case-insensitive whole-value equality (unlike CONTAINS). */
  EQUALS_IGNORE_CASE = 'ieq',
  /** Membership; the value is a non-empty list. */
  IN = 'in',
  IS_NULL = 'null',
  IS_NOT_NULL = 'notnull',
}

/** Operators whose value is a list rather than a scalar. */
export const LIST_OPERATORS: readonly FilterOperator[] = [FilterOperator.IN, FilterOperator.BETWEEN];

/** Operators that take no value at all. */
export const VALUELESS_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.IS_NULL,
  FilterOperator.IS_NOT_NULL,
];
