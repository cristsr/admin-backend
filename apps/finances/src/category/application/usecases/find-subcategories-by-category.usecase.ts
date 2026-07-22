import { Injectable } from '@nestjs/common';
import { Subcategory, SubcategoryReports, SubcategoryRepository } from '@app/category/domain/subcategory';

@Injectable()
export class FindSubcategoriesByCategoryUsecase {
  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async execute(categoryId: number): Promise<Subcategory[]> {
    return this.subcategoryRepository.matching(SubcategoryReports.ofCategory(categoryId));
  }
}
