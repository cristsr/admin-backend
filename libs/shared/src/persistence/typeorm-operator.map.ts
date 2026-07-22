import {
  Between,
  Equal,
  FindOperator,
  ILike,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { Filter, FilterOperator, FilterScalar, InvalidCriteriaException } from '../criteria';

/** Builds the TypeORM operator for a filter from its already-flattened values. */
type OperatorBuilder = (values: readonly FilterScalar[]) => FindOperator<unknown>;

/**
 * One builder per operator. Total over `FilterOperator`, so a new operator
 * fails compilation here until it is mapped.
 */
const OPERATOR_BUILDERS: Readonly<Record<FilterOperator, OperatorBuilder>> = {
  [FilterOperator.EQUAL]: ([first]) => Equal(first),
  [FilterOperator.NOT_EQUAL]: ([first]) => Not(Equal(first)),
  [FilterOperator.GREATER_THAN]: ([first]) => MoreThan(first),
  [FilterOperator.GREATER_OR_EQUAL]: ([first]) => MoreThanOrEqual(first),
  [FilterOperator.LESS_THAN]: ([first]) => LessThan(first),
  [FilterOperator.LESS_OR_EQUAL]: ([first]) => LessThanOrEqual(first),
  [FilterOperator.BETWEEN]: ([first, second]) => Between(first, second),
  [FilterOperator.CONTAINS]: ([first]) => ILike(`%${String(first)}%`),
  [FilterOperator.EQUALS_IGNORE_CASE]: ([first]) => ILike(String(first)),
  [FilterOperator.IN]: (values) => In([...values]),
  [FilterOperator.IS_NULL]: () => IsNull(),
  [FilterOperator.IS_NOT_NULL]: () => Not(IsNull()),
};

/** Translates a filter into the TypeORM operator that backs it. */
export function buildFindOperator<TField extends string>(filter: Filter<TField>): FindOperator<unknown> {
  const build = OPERATOR_BUILDERS[filter.operator];

  if (!build) {
    throw new InvalidCriteriaException(`Unsupported filter operator "${filter.operator}"`, {
      context: { field: filter.field, operator: filter.operator },
    });
  }

  return build(filter.values);
}
