import {
  FilterOperator,
  LIST_OPERATORS,
  VALUELESS_OPERATORS,
} from './filter-operator';
import { InvalidCriteriaException } from './invalid-criteria.exception';

/** A value a filter can compare against. */
export type FilterScalar = string | number | boolean | Date;

export type FilterValue = FilterScalar | readonly FilterScalar[];

/**
 * One `field operator value` condition. Instances are immutable and always
 * valid: `Filter.of` refuses a combination the adapters could not honour
 * (a `BETWEEN` without both bounds, an `IN` with no members), so no adapter
 * has to re-check it.
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

  /** The value as a list, for the operators that carry one. */
  get values(): readonly FilterScalar[] {
    return Array.isArray(this.value) ? this.value : [this.value as FilterScalar];
  }
}
