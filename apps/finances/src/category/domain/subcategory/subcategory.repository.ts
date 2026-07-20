import { Criteria, Nullable } from '@shared';
import { SubcategoryField } from './subcategory.criteria';
import { Subcategory } from './subcategory.entity';

/**
 * Reads take a criteria; the questions themselves live in
 * `SubcategoryCriteria`, stated in domain terms.
 */
export abstract class SubcategoryRepository {
  abstract matching(
    criteria: Criteria<SubcategoryField>,
  ): Promise<Subcategory[]>;

  abstract firstMatching(
    criteria: Criteria<SubcategoryField>,
  ): Promise<Nullable<Subcategory>>;

  abstract save(subcategory: Subcategory): Promise<Subcategory>;

  abstract saveMany(subcategories: Subcategory[]): Promise<void>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(
    criteria: Criteria<SubcategoryField>,
  ): Promise<number>;
}
