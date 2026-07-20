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
 * Public query surface over the shared taxonomy. `isSystem` stays out: it is
 * a seed detail, not a facet to browse by.
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

  /** Case-insensitive whole-name resolution, so "Food" never lands in "Fast Food". */
  static byName(name: string): Criteria<CategoryField> {
    return Criteria.none<CategoryField>().equalsIgnoreCase('name', name);
  }

  /**
   * Fallback when nothing else classifies a movement; lowest id wins so a
   * stray duplicate cannot change the answer.
   */
  static systemDefault(): Criteria<CategoryField> {
    return Criteria.none<CategoryField>()
      .equals('isSystem', true)
      .orderBy('id', OrderType.ASC);
  }

  /** Whole taxonomy, unpaginated: the ingestion pipeline consumes it as one flat list. */
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
