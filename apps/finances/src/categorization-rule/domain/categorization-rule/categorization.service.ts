import { Injectable } from '@nestjs/common';
import {
  CategoryCriteria,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import { CategorizationInput } from './categorization-input.type';
import { CategorizationRuleCriteria } from './categorization-rule.criteria';
import { CategorizationRuleRepository } from './categorization-rule.repository';
import { CategoryAssignment } from './category-assignment.type';

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

  async categorize(
    input: CategorizationInput,
    user: number,
  ): Promise<CategoryAssignment> {
    const rules = await this.ruleRepository.matching(
      CategorizationRuleCriteria.byPriority(user),
    );

    const match = rules.find((rule) =>
      rule.matches(input.merchant, input.description),
    );

    if (match) {
      return {
        categoryId: match.categoryId,
        subcategoryId: match.subcategoryId,
      };
    }

    const fallback = await this.categoryRepository.firstMatching(
      CategoryCriteria.systemDefault(),
    );

    if (!fallback) {
      throw new CategoryNotFoundException(
        'Default "Sin categorizar" category is missing',
      );
    }

    return { categoryId: fallback.id };
  }
}
