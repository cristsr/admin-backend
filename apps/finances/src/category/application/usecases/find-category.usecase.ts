import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Category, CategoryLookups, CategoryRepository } from '@app/category/domain/category';

@Injectable()
export class FindCategoryUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number): Promise<Nullable<Category>> {
    return this.categoryRepository.firstMatching(CategoryLookups.byId(id));
  }
}
