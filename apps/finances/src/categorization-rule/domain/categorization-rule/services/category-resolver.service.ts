import { Injectable } from '@nestjs/common';
import {
  CategoryLookups,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import {
  SubcategoryLookups,
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import { CategorizationInput } from '../types/categorization-input.type';
import { CategoryAssignment } from '../types/category-assignment.type';
import { CategorySelectionByIds } from '../types/category-selection-by-ids.type';
import { CategorySelectionByNames } from '../types/category-selection-by-names.type';
import { CategorizationService } from './categorization.service';

/**
 * Settles the category of an incoming movement: an explicit category is
 * validated, otherwise the auto-categorization rules decide.
 */
@Injectable()
export class CategoryResolver {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly subcategoryRepository: SubcategoryRepository,
    private readonly categorization: CategorizationService,
  ) {}

  async resolveByIds(
    selection: CategorySelectionByIds,
    hints: CategorizationInput,
    user: number,
  ): Promise<CategoryAssignment> {
    if (!selection.categoryId) {
      return this.categorization.categorize(hints, user);
    }

    const [category, subcategory] = await Promise.all([
      this.categoryRepository.firstMatching(CategoryLookups.byId(selection.categoryId)),
      this.findSubcategoryByIds(selection.categoryId, selection.subcategoryId),
    ]);

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    if (selection.subcategoryId && !subcategory) {
      throw new SubcategoryNotFoundException('Subcategory not found');
    }

    return { categoryId: category.id, subcategoryId: subcategory?.id };
  }

  private async findSubcategoryByIds(categoryId: number, subcategoryId?: number) {
    if (!subcategoryId) return null;

    return this.subcategoryRepository.firstMatching(
      SubcategoryLookups.byIdAndCategory(subcategoryId, categoryId),
    );
  }

  private async findSubcategoryByNames(categoryId: number, subcategory?: string) {
    if (!subcategory) return null;

    return this.subcategoryRepository.firstMatching(
      SubcategoryLookups.byNameAndCategory(subcategory, categoryId),
    );
  }

  async resolveByNames(
    selection: CategorySelectionByNames,
    hints: CategorizationInput,
    user: number,
  ): Promise<CategoryAssignment> {
    if (!selection.category) {
      return this.categorization.categorize(hints, user);
    }

    const category = await this.categoryRepository.firstMatching(CategoryLookups.byName(selection.category));

    if (!category) {
      throw new CategoryNotFoundException(`Category "${selection.category}" not found`);
    }

    const subcategory = await this.findSubcategoryByNames(category.id, selection.subcategory);

    if (selection.subcategory && !subcategory) {
      throw new SubcategoryNotFoundException(
        `Subcategory "${selection.subcategory}" not found under category "${selection.category}"`,
      );
    }

    return { categoryId: category.id, subcategoryId: subcategory?.id };
  }
}
