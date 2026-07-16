import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Category, CategoryRepository } from '../../domain/category';

@Injectable()
export class FindCategoryUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number): Promise<Nullable<Category>> {
    return this.categoryRepository.findById(id);
  }
}
