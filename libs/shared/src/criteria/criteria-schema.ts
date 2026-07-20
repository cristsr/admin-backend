import { CriteriaFieldDefinition } from './criteria-field-definition.type';
import { FilterOperator } from './filter-operator';

/** How a raw query-string value must be read before it reaches a filter. */
export enum CriteriaValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
}

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

export const TEXT_OPERATORS: readonly FilterOperator[] = [
  FilterOperator.EQUAL,
  FilterOperator.NOT_EQUAL,
  FilterOperator.EQUALS_IGNORE_CASE,
  FilterOperator.CONTAINS,
  FilterOperator.IN,
];

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

/**
 * The publicly filterable surface of an aggregate. Deliberately partial:
 * fields absent from it stay code-only and cannot be driven by callers.
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
