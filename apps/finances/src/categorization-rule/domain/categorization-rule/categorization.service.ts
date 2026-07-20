import { Injectable } from '@nestjs/common';
import {
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import { CategorizationRuleRepository } from './categorization-rule.repository';

/** What is known about a movement that arrived without a category. */
export interface CategorizationInput {
  merchant?: string;
  description?: string;
}

/** The category a movement ends up filed under. */
export interface CategoryAssignment {
  categoryId: number;
  subcategoryId?: number;
}

/**
 * AC-4 (sm-0003) — decides the category of a movement that arrived without
 * one. The first rule (highest priority) that claims it wins; if none does, the
 * movement falls back to the system default category ("Sin categorizar") so it
 * is never left uncategorized.
 */
@Injectable()
export class CategorizationService {
  constructor(
    private readonly ruleRepository: CategorizationRuleRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async categorize(
    input: CategorizationInput,
    user: number,
  ): Promise<CategoryAssignment> {
    const rules = await this.ruleRepository.findByUserOrderByPriorityDesc(user);

    const match = rules.find((rule) =>
      rule.matches(input.merchant, input.description),
    );

    if (match) {
      return {
        categoryId: match.categoryId,
        subcategoryId: match.subcategoryId,
      };
    }

    const fallback = await this.categoryRepository.findSystemDefault();

    if (!fallback) {
      throw new CategoryNotFoundException(
        'Default "Sin categorizar" category is missing',
      );
    }

    return { categoryId: fallback.id };
  }
}
