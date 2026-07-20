import { Criteria, OrderType } from '@shared';

/** Every subcategory attribute a criteria may name. */
export type SubcategoryField = 'id' | 'name' | 'category' | 'createdAt';

/**
 * Named queries over subcategories; no HTTP schema: they are only reached
 * through their category.
 */
export class SubcategoryCriteria {
  static byId(id: number): Criteria<SubcategoryField> {
    return Criteria.none<SubcategoryField>().equals('id', id);
  }

  static byIdAndCategory(
    id: number,
    category: number,
  ): Criteria<SubcategoryField> {
    return SubcategoryCriteria.byId(id).equals('category', category);
  }

  static ofCategory(category: number): Criteria<SubcategoryField> {
    return Criteria.none<SubcategoryField>()
      .equals('category', category)
      .orderBy('name', OrderType.ASC);
  }

  /** Case-insensitive whole-name resolution inside one category. */
  static byNameAndCategory(
    name: string,
    category: number,
  ): Criteria<SubcategoryField> {
    return Criteria.none<SubcategoryField>()
      .equalsIgnoreCase('name', name)
      .equals('category', category);
  }
}
