import { Nullable } from '@shared';
import { Category } from './category.entity';

export interface CategoryQuery {
  take?: number;
  skip?: number;
}

export abstract class CategoryRepository {
  abstract findById(id: number): Promise<Nullable<Category>>;

  abstract findByName(name: string): Promise<Nullable<Category>>;

  abstract findAll(query?: CategoryQuery): Promise<Category[]>;

  abstract save(category: Category): Promise<Category>;

  abstract saveMany(categories: Category[]): Promise<void>;

  abstract remove(id: number): Promise<boolean>;
}
