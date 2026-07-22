import { Injectable } from '@nestjs/common';
import {
  CategoryIsSystemException,
  CategoryLookups,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';

@Injectable()
export class RemoveCategoryUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number): Promise<boolean> {
    const category = await this.categoryRepository.firstMatching(CategoryLookups.byId(id));

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    if (category.system) {
      throw new CategoryIsSystemException('System categories cannot be deleted');
    }

    const removed = await this.categoryRepository.removeMatching(CategoryLookups.byId(id));

    return !!removed;
  }
}
