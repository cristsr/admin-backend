import { Injectable } from '@nestjs/common';
import { CriteriaQueryDto } from '@shared';
import { Category, CategoryListing, CategoryRepository } from '@app/category/domain/category';

@Injectable()
export class FindAllCategoriesUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(query?: CriteriaQueryDto): Promise<Category[]> {
    return this.categoryRepository.matching(CategoryListing.fromQuery(query));
  }
}
