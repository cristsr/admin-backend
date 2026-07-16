import { Injectable } from '@nestjs/common';
import { normalizePagination } from '@shared';
import { Category, CategoryRepository } from '../../domain/category';
import { CategoryFilterDto } from '../dto/category-filter.dto';

@Injectable()
export class FindAllCategoriesUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(filter: CategoryFilterDto = {}): Promise<Category[]> {
    const { take, skip } = normalizePagination(filter);
    return this.categoryRepository.findAll({ take, skip });
  }
}
