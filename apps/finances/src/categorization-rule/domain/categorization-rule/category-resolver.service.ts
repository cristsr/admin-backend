import { Injectable } from '@nestjs/common';
import {
  CategoryCriteria,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import {
  SubcategoryCriteria,
  SubcategoryNotFoundException,
  SubcategoryRepository,
} from '@app/category/domain/subcategory';
import {
  CategorizationInput,
  CategorizationService,
  CategoryAssignment,
} from './categorization.service';

/** A category picked by id, the way the manual API refers to it. */
export interface CategorySelectionByIds {
  categoryId?: number;
  subcategoryId?: number;
}

/** A category named in plain text, the way ingestion providers send it. */
export interface CategorySelectionByNames {
  category?: string;
  subcategory?: string;
}

/**
 * Settles the category of an incoming movement. The rule is the same wherever
 * the movement comes from: an explicit category is honored but must exist,
 * and no category at all means the auto-categorization rules decide (AC-4).
 * Providers name their categories while the API refers to them by id, which is
 * the only difference between the two entry points.
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
      this.categoryRepository.firstMatching(
        CategoryCriteria.byId(selection.categoryId),
      ),
      selection.subcategoryId
        ? this.subcategoryRepository.firstMatching(
            SubcategoryCriteria.byIdAndCategory(
              selection.subcategoryId,
              selection.categoryId,
            ),
          )
        : null,
    ]);

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    if (selection.subcategoryId && !subcategory) {
      throw new SubcategoryNotFoundException('Subcategory not found');
    }

    return { categoryId: category.id, subcategoryId: subcategory?.id };
  }

  async resolveByNames(
    selection: CategorySelectionByNames,
    hints: CategorizationInput,
    user: number,
  ): Promise<CategoryAssignment> {
    if (!selection.category) {
      return this.categorization.categorize(hints, user);
    }

    const category = await this.categoryRepository.firstMatching(
      CategoryCriteria.byName(selection.category),
    );

    if (!category) {
      throw new CategoryNotFoundException(
        `Category "${selection.category}" not found`,
      );
    }

    const subcategory = selection.subcategory
      ? await this.subcategoryRepository.firstMatching(
          SubcategoryCriteria.byNameAndCategory(
            selection.subcategory,
            category.id,
          ),
        )
      : null;

    if (selection.subcategory && !subcategory) {
      throw new SubcategoryNotFoundException(
        `Subcategory "${selection.subcategory}" not found under category "${selection.category}"`,
      );
    }

    return { categoryId: category.id, subcategoryId: subcategory?.id };
  }
}
