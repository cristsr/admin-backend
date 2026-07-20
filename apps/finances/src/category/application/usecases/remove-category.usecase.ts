import { Injectable } from '@nestjs/common';
import {
  CategoryCriteria,
  CategoryIsSystemException,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';

@Injectable()
export class RemoveCategoryUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number): Promise<boolean> {
    const category = await this.categoryRepository.firstMatching(
      CategoryCriteria.byId(id),
    );

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    // AC-4: the default "Sin categorizar" (and any system category) is protected.
    if (category.system) {
      throw new CategoryIsSystemException(
        'System categories cannot be deleted',
      );
    }

    const removed = await this.categoryRepository.removeMatching(
      CategoryCriteria.byId(id),
    );

    return !!removed;
  }
}
