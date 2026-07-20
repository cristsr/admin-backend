import { Injectable } from '@nestjs/common';
import {
  CategoryCriteria,
  CategoryRepository,
} from '@app/category/domain/category';

/**
 * Flat list of "Category" and "Category/Subcategory" strings, the contract
 * the ingestion pipeline's category provider consumes.
 */
@Injectable()
export class GetTaxonomyUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(): Promise<string[]> {
    const categories = await this.categoryRepository.matching(
      CategoryCriteria.all(),
    );

    return categories.flatMap((category) => [
      category.name,
      ...(category.subcategories ?? []).map(
        (subcategory) => `${category.name}/${subcategory.name}`,
      ),
    ]);
  }
}
