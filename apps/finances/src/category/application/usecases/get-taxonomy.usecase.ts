import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../../domain/category';

/**
 * Flat list of "Category" and "Category/Subcategory" strings, matching the
 * folder-taxonomy contract already used by the Rust ingestion pipeline's
 * `CategoryProvider` (`shared::analysis::HttpCategoryProvider` expects
 * `{ categories: string[] }`, historically sourced from scanning the Finanzas
 * folder up to two levels deep).
 */
@Injectable()
export class GetTaxonomyUsecase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(): Promise<string[]> {
    const categories = await this.categoryRepository.findAll();

    return categories.flatMap((category) => [
      category.name,
      ...(category.subcategories ?? []).map(
        (subcategory) => `${category.name}/${subcategory.name}`,
      ),
    ]);
  }
}
