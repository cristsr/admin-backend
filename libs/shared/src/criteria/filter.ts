import { FilterOperator, LIST_OPERATORS, VALUELESS_OPERATORS } from './filter-operator';
import { InvalidCriteriaException } from './invalid-criteria.exception';

export type FilterScalar = string | number | boolean | Date;

export type FilterValue = FilterScalar | readonly FilterScalar[];

/**
 * One `field operator value` condition. Immutable and always valid:
 * `Filter.of` rejects combinations adapters could not honour.
 */
export class Filter<TField extends string = string> {
  private constructor(
    readonly field: TField,
    readonly operator: FilterOperator,
    readonly value: FilterValue,
  ) {}

  static of<TField extends string>(
    field: TField,
    operator: FilterOperator,
    value?: FilterValue,
  ): Filter<TField> {
    if (VALUELESS_OPERATORS.includes(operator)) {
      return new Filter(field, operator, null);
    }

    if (value === undefined || value === null) {
      throw new InvalidCriteriaException(
        `Filter on "${field}" with operator "${operator}" requires a value`,
        { context: { field, operator } },
      );
    }

    if (!LIST_OPERATORS.includes(operator)) {
      return new Filter(field, operator, value);
    }

    if (!Array.isArray(value) || !value.length) {
      throw new InvalidCriteriaException(
        `Filter on "${field}" with operator "${operator}" requires a non-empty list`,
        { context: { field, operator } },
      );
    }

    if (operator === FilterOperator.BETWEEN && value.length !== 2) {
      throw new InvalidCriteriaException(
        `Filter on "${field}" with operator "between" requires exactly two bounds`,
        { context: { field, bounds: value.length } },
      );
    }

    return new Filter(field, operator, value);
  }

  /** Scalar values are wrapped as a single-member list. */
  get values(): readonly FilterScalar[] {
    if (Array.isArray(this.value)) return this.value;

    return [this.value as FilterScalar];
  }
}
