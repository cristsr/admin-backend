import { Criteria, OrderType } from '@shared';
import { CategoryField } from './category-field.type';

/** Identity lookups over the shared category taxonomy. */
export class CategoryLookups {
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
    return Criteria.none<CategoryField>().equals('isSystem', true).orderBy('id', OrderType.ASC);
  }
}
