import { Injectable } from '@nestjs/common';
import {
  Subcategory,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';

@Injectable()
export class FindSubcategoriesByCategoryUsecase {
  constructor(private readonly subcategoryRepository: SubcategoryRepository) {}

  async execute(categoryId: number): Promise<Subcategory[]> {
    return this.subcategoryRepository.findByCategory(categoryId);
  }
}
