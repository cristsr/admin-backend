import { Criteria, Nullable } from '@shared';
import { CategoryField } from '../criteria/category-field.type';
import { Category } from '../entities/category.entity';

/** Queries are stated in domain terms via the `Category*` criteria classes. */
export abstract class CategoryRepository {
  abstract matching(criteria: Criteria<CategoryField>): Promise<Category[]>;

  abstract firstMatching(criteria: Criteria<CategoryField>): Promise<Nullable<Category>>;

  abstract save(category: Category): Promise<Category>;

  /** Persists a batch with its subcategories in a single transaction. */
  abstract saveMany(categories: Category[]): Promise<void>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(criteria: Criteria<CategoryField>): Promise<number>;
}
