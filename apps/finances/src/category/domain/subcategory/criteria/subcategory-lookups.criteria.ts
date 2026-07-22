import { Criteria } from '@shared';
import { SubcategoryField } from './subcategory-field.type';

/** Identity lookups over subcategories, always reached through their category. */
export class SubcategoryLookups {
  static byId(id: number): Criteria<SubcategoryField> {
    return Criteria.none<SubcategoryField>().equals('id', id);
  }

  static byIdAndCategory(id: number, category: number): Criteria<SubcategoryField> {
    return SubcategoryLookups.byId(id).equals('category', category);
  }

  /** Case-insensitive whole-name resolution inside one category. */
  static byNameAndCategory(name: string, category: number): Criteria<SubcategoryField> {
    return Criteria.none<SubcategoryField>().equalsIgnoreCase('name', name).equals('category', category);
  }
}
