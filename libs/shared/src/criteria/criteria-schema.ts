import { FilterOperator } from './filter-operator';

/** How a raw query-string value must be read before it reaches a filter. */
export enum CriteriaValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
}

/** Operators that make sense on anything ordered: numbers and dates. */
export const COMPARABLE_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.EQUAL,
  FilterOperator.NOT_EQUAL,
  FilterOperator.GREATER_THAN,
  FilterOperator.GREATER_OR_EQUAL,
  FilterOperator.LESS_THAN,
  FilterOperator.LESS_OR_EQUAL,
  FilterOperator.BETWEEN,
  FilterOperator.IN,
];

/** Operators for free text. */
export const TEXT_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.EQUAL,
  FilterOperator.NOT_EQUAL,
  FilterOperator.EQUALS_IGNORE_CASE,
  FilterOperator.CONTAINS,
  FilterOperator.IN,
];

/** Operators for opaque identifiers and flags: match or don't. */
export const IDENTITY_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.EQUAL,
  FilterOperator.NOT_EQUAL,
  FilterOperator.IN,
];

const DEFAULT_OPERATORS: Readonly<
  Record<CriteriaValueType, readonly FilterOperator[]>
> = {
  [CriteriaValueType.STRING]: TEXT_OPERATORS,
  [CriteriaValueType.NUMBER]: COMPARABLE_OPERATORS,
  [CriteriaValueType.DATE]: COMPARABLE_OPERATORS,
  [CriteriaValueType.BOOLEAN]: IDENTITY_OPERATORS,
};

export interface CriteriaFieldDefinition {
  readonly type: CriteriaValueType;

  /**
   * Operators the field accepts. Defaults to the sensible set for its value
   * type, so a schema only spells this out when it wants to narrow it.
   */
  readonly operators?: readonly FilterOperator[];

  /** Whether the field may be named in `orderBy`. Defaults to false. */
  readonly isSortable?: boolean;

  /**
   * Whether a caller may filter by NULL / NOT NULL. Off by default because on
   * most columns it leaks more than it helps.
   */
  readonly isNullable?: boolean;
}

/**
 * The publicly filterable surface of an aggregate: the fields a REST caller is
 * allowed to name, and what they may do with each.
 *
 * It is deliberately partial. A field absent from the schema stays perfectly
 * usable from code — use cases build those filters themselves — it simply
 * cannot be driven from the query string. That is how `user` stays server-side
 * only: the use case pins it, and no caller can widen it to somebody else.
 */
export type CriteriaSchema<TField extends string> = Partial<
  Record<TField, CriteriaFieldDefinition>
>;

/** The operators a definition accepts, resolving the per-type default. */
export function allowedOperators(
  definition: CriteriaFieldDefinition,
): readonly FilterOperator[] {
  const declared = definition.operators ?? DEFAULT_OPERATORS[definition.type];

  if (!definition.isNullable) return declared;

  return [...declared, FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL];
}
