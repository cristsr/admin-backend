import { Criteria, OrderType } from '@shared';
import { SubcategoryField } from './subcategory-field.type';

/** Collection queries over the subcategories of a category. */
export class SubcategoryReports {
  static ofCategory(category: number): Criteria<SubcategoryField> {
    return Criteria.none<SubcategoryField>().equals('category', category).orderBy('name', OrderType.ASC);
  }
}
