import { FindManyOptions, FindOptionsOrder, FindOptionsWhere } from 'typeorm';
import { Criteria, InvalidCriteriaException } from '../criteria';
import { ObjectLiteral } from '../types/object-literal';
import { CriteriaFieldMap } from './criteria-field-map.type';
import { assignAtPath } from './find-options.writer';
import { ORDER_DIRECTION } from './order-direction.map';
import { buildFindOperator } from './typeorm-operator.map';

/**
 * Translates a criteria into TypeORM `find` options. A stateless utility: the
 * per-entity field map is passed in, so there is nothing to instantiate — the
 * static methods are called directly and a private constructor forbids `new`.
 * Relations to eager-load and the entity itself stay with the repository.
 */
export class TypeOrmCriteriaConverter {
  static toFindOptions<TEntity extends ObjectLiteral, TField extends string>(
    fields: CriteriaFieldMap<TField>,
    criteria: Criteria<TField>,
  ): FindManyOptions<TEntity> {
    return {
      where: TypeOrmCriteriaConverter.toWhere<TEntity, TField>(fields, criteria),
      order: TypeOrmCriteriaConverter.toOrder<TEntity, TField>(fields, criteria),
      take: criteria.pagination?.take,
      skip: criteria.pagination?.skip,
    };
  }

  /** The `where` alone, for operations without ordering or paging (`count`, `sum`). */
  static toWhere<TEntity extends ObjectLiteral, TField extends string>(
    fields: CriteriaFieldMap<TField>,
    criteria: Criteria<TField>,
  ): FindOptionsWhere<TEntity> {
    return criteria.filters.reduce<ObjectLiteral>(
      (where, filter) =>
        assignAtPath(where, TypeOrmCriteriaConverter.pathOf(fields, filter.field), buildFindOperator(filter)),
      {},
    ) as FindOptionsWhere<TEntity>;
  }

  static toOrder<TEntity extends ObjectLiteral, TField extends string>(
    fields: CriteriaFieldMap<TField>,
    criteria: Criteria<TField>,
  ): FindOptionsOrder<TEntity> {
    return criteria.orders.reduce<ObjectLiteral>(
      (order, clause) =>
        assignAtPath(
          order,
          TypeOrmCriteriaConverter.pathOf(fields, clause.field),
          ORDER_DIRECTION[clause.type],
        ),
      {},
    ) as FindOptionsOrder<TEntity>;
  }

  private static pathOf<TField extends string>(fields: CriteriaFieldMap<TField>, field: TField): string {
    const path = fields[field];

    if (!path) {
      throw new InvalidCriteriaException(`Field "${field}" has no persistence mapping`, {
        context: { field },
      });
    }

    return path;
  }
}
