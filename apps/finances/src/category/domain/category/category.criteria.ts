import {
  Criteria,
  CriteriaQueryDto,
  CriteriaSchema,
  CriteriaValueType,
  Nullable,
  OrderType,
  criteriaFromQuery,
} from '@shared';

/** Every category attribute a criteria may name. */
export type CategoryField =
  | 'id'
  | 'name'
  | 'icon'
  | 'color'
  | 'isSystem'
  | 'createdAt';

/**
 * Categories are a shared taxonomy rather than user-owned data, so the whole
 * useful surface is public. `isSystem` stays out: whether a category ships with
 * the product is an implementation detail of the seed, not a facet to browse by.
 */
export const CATEGORY_CRITERIA_SCHEMA: CriteriaSchema<CategoryField> = {
  name: { type: CriteriaValueType.STRING, isSortable: true },
  createdAt: { type: CriteriaValueType.DATE, isSortable: true },
  id: { type: CriteriaValueType.NUMBER },
};

/** Named queries over the category taxonomy. */
export class CategoryCriteria {
  static byId(id: number): Criteria<CategoryField> {
    return Criteria.none<CategoryField>().equals('id', id);
  }

  /**
   * Resolution by the name a provider or an import sent. Case-insensitive but
   * whole-name: a payload saying "Food" must not land in "Fast Food".
   */
  static byName(name: string): Criteria<CategoryField> {
    return Criteria.none<CategoryField>().equalsIgnoreCase('name', name);
  }

  /**
   * The fallback category used when nothing else classifies a movement
   * (AC-4). Lowest id wins so a stray duplicate cannot change the answer.
   */
  static systemDefault(): Criteria<CategoryField> {
    return Criteria.none<CategoryField>()
      .equals('isSystem', true)
      .orderBy('id', OrderType.ASC);
  }

  /**
   * The whole taxonomy, unpaginated. The ingestion pipeline consumes it as a
   * single flat list, so a page would silently cut categories out of it.
   */
  static all(): Criteria<CategoryField> {
    return Criteria.none<CategoryField>().orderBy('name', OrderType.ASC);
  }

  static list(query: Nullable<CriteriaQueryDto>): Criteria<CategoryField> {
    const criteria = criteriaFromQuery(query, CATEGORY_CRITERIA_SCHEMA);

    return criteria.hasOrders
      ? criteria
      : criteria.orderBy('name', OrderType.ASC);
  }
}
