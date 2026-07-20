import {
  And,
  Between,
  Equal,
  FindManyOptions,
  FindOperator,
  FindOptionsOrder,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import {
  Criteria,
  Filter,
  FilterOperator,
  InvalidCriteriaException,
  OrderType,
} from '../criteria';
import { ObjectLiteral } from '../types/object-literal';

/**
 * Maps every domain field of an aggregate to the TypeORM property path that
 * backs it — `'account'` to `'account.id'`, `'user'` to `'user'`.
 *
 * The `Record` is total on purpose: adding a name to the field union breaks
 * compilation here until the adapter says where it lives, so a criteria can
 * never reach the database with a field nobody mapped.
 */
export type CriteriaFieldMap<TField extends string> = Readonly<
  Record<TField, string>
>;

const ORDER_DIRECTION: Readonly<Record<OrderType, 'ASC' | 'DESC'>> = {
  [OrderType.ASC]: 'ASC',
  [OrderType.DESC]: 'DESC',
};

/**
 * Translates a criteria into the `find` options of a TypeORM repository.
 *
 * It resolves the *what* of a query and nothing else: relations to eager-load
 * and the entity being queried stay with the repository, which is the only
 * place that knows which shape its mapper needs.
 */
export class TypeOrmCriteriaConverter<
  TEntity extends ObjectLiteral,
  TField extends string,
> {
  constructor(private readonly fields: CriteriaFieldMap<TField>) {}

  toFindOptions(criteria: Criteria<TField>): FindManyOptions<TEntity> {
    return {
      where: this.toWhere(criteria),
      order: this.toOrder(criteria),
      take: criteria.pagination?.take,
      skip: criteria.pagination?.skip,
    };
  }

  /**
   * The `where` alone, for the repository operations that take one without
   * ordering or paging — `count`, `sum`, `softDelete`.
   */
  toWhere(criteria: Criteria<TField>): FindOptionsWhere<TEntity> {
    return criteria.filters.reduce<ObjectLiteral>(
      (where, filter) =>
        this.assign(where, this.pathOf(filter.field), this.toOperator(filter)),
      {},
    ) as FindOptionsWhere<TEntity>;
  }

  toOrder(criteria: Criteria<TField>): FindOptionsOrder<TEntity> {
    return criteria.orders.reduce<ObjectLiteral>(
      (order, clause) =>
        this.assign(
          order,
          this.pathOf(clause.field),
          ORDER_DIRECTION[clause.type],
        ),
      {},
    ) as FindOptionsOrder<TEntity>;
  }

  private pathOf(field: TField): string {
    const path = this.fields[field];

    if (!path) {
      throw new InvalidCriteriaException(
        `Field "${field}" has no persistence mapping`,
        { context: { field } },
      );
    }

    return path;
  }

  /**
   * Writes `value` at a dotted path, creating the intermediate objects a
   * relation filter needs (`account.id` becomes `{ account: { id } }`).
   * Two conditions on the same column are ANDed rather than overwriting, so
   * `amount > 10` and `amount < 100` compose into a real range.
   */
  private assign(
    target: ObjectLiteral,
    path: string,
    value: unknown,
  ): ObjectLiteral {
    const segments = path.split('.');
    const leaf = segments.pop();

    const node = segments.reduce<ObjectLiteral>((current, segment) => {
      current[segment] = current[segment] ?? {};
      return current[segment] as ObjectLiteral;
    }, target);

    const existing = node[leaf];

    node[leaf] =
      existing instanceof FindOperator && value instanceof FindOperator
        ? And(existing, value)
        : value;

    return target;
  }

  private toOperator(filter: Filter<TField>): FindOperator<unknown> {
    const [first, second] = filter.values;

    switch (filter.operator) {
      case FilterOperator.EQUAL:
        return Equal(first);
      case FilterOperator.NOT_EQUAL:
        return Not(Equal(first));
      case FilterOperator.GREATER_THAN:
        return MoreThan(first);
      case FilterOperator.GREATER_OR_EQUAL:
        return MoreThanOrEqual(first);
      case FilterOperator.LESS_THAN:
        return LessThan(first);
      case FilterOperator.LESS_OR_EQUAL:
        return LessThanOrEqual(first);
      case FilterOperator.BETWEEN:
        return Between(first, second);
      case FilterOperator.CONTAINS:
        return ILike(`%${String(first)}%`);
      case FilterOperator.EQUALS_IGNORE_CASE:
        return ILike(String(first));
      case FilterOperator.IN:
        return In([...filter.values]);
      case FilterOperator.IS_NULL:
        return IsNull();
      case FilterOperator.IS_NOT_NULL:
        return Not(IsNull());
      default:
        throw new InvalidCriteriaException(
          `Unsupported filter operator "${filter.operator}"`,
          { context: { field: filter.field, operator: filter.operator } },
        );
    }
  }
}
