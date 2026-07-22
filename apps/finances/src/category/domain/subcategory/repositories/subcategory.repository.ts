import { Criteria, Nullable } from '@shared';
import { SubcategoryField } from '../criteria/subcategory-field.type';
import { Subcategory } from '../entities/subcategory.entity';

/** Queries are stated in domain terms via the `Subcategory*` criteria classes. */
export abstract class SubcategoryRepository {
  abstract matching(criteria: Criteria<SubcategoryField>): Promise<Subcategory[]>;

  abstract firstMatching(criteria: Criteria<SubcategoryField>): Promise<Nullable<Subcategory>>;

  abstract save(subcategory: Subcategory): Promise<Subcategory>;

  abstract saveMany(subcategories: Subcategory[]): Promise<void>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(criteria: Criteria<SubcategoryField>): Promise<number>;
}
