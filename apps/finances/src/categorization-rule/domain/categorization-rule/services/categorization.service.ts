import { Injectable } from '@nestjs/common';
import {
  CategoryLookups,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import { CategorizationRuleReports } from '../criteria/categorization-rule-reports.criteria';
import { CategorizationRuleRepository } from '../repositories/categorization-rule.repository';
import { CategorizationInput } from '../types/categorization-input.type';
import { CategoryAssignment } from '../types/category-assignment.type';

/**
 * Decides the category of an uncategorized movement: the highest-priority
 * matching rule wins, else the system default category.
 */
@Injectable()
export class CategorizationService {
  constructor(
    private readonly ruleRepository: CategorizationRuleRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async categorize(input: CategorizationInput, user: number): Promise<CategoryAssignment> {
    const rules = await this.ruleRepository.matching(CategorizationRuleReports.byPriority(user));

    const match = rules.find((rule) => rule.matches(input.merchant, input.description));

    if (match) {
      return {
        categoryId: match.categoryId,
        subcategoryId: match.subcategoryId,
      };
    }

    const fallback = await this.categoryRepository.firstMatching(CategoryLookups.systemDefault());

    if (!fallback) {
      throw new CategoryNotFoundException('Default "Sin categorizar" category is missing');
    }

    return { categoryId: fallback.id };
  }
}
