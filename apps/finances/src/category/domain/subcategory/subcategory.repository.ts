import { Nullable } from '@shared';
import { Subcategory } from './subcategory.entity';

export abstract class SubcategoryRepository {
  abstract findById(id: number): Promise<Nullable<Subcategory>>;

  abstract findByIdAndCategory(
    id: number,
    categoryId: number,
  ): Promise<Nullable<Subcategory>>;

  abstract findByCategory(categoryId: number): Promise<Subcategory[]>;

  abstract findByNameAndCategory(
    name: string,
    categoryId: number,
  ): Promise<Nullable<Subcategory>>;

  abstract save(subcategory: Subcategory): Promise<Subcategory>;

  abstract saveMany(subcategories: Subcategory[]): Promise<void>;

  abstract remove(id: number): Promise<boolean>;
}
