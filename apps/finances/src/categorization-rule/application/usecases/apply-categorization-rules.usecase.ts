import { Injectable } from '@nestjs/common';
import {
  CategoryNotFoundException,
  CategoryRepository,
} from '../../../category/domain/category';
import { CategorizationRuleRepository } from '../../domain/categorization-rule';

export interface CategorizationInput {
  merchant?: string;
  description?: string;
}

export interface CategorizationResult {
  categoryId: number;
  subcategoryId?: number;
}

/**
 * AC-4 (sm-0003) — resolves the category for a movement that arrived without
 * one. The first rule (highest priority) whose pattern is a case-insensitive
 * substring of the merchant or description wins; if none match, the movement
 * falls back to the system default category ("Sin categorizar").
 */
@Injectable()
export class ApplyCategorizationRulesUsecase {
  constructor(
    private readonly ruleRepository: CategorizationRuleRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    input: CategorizationInput,
    user: number,
  ): Promise<CategorizationResult> {
    const haystack = `${input.merchant ?? ''} ${input.description ?? ''}`.toLowerCase();
    const rules = await this.ruleRepository.findByUserOrderByPriorityDesc(user);

    const match = rules.find((rule) =>
      haystack.includes(rule.pattern.toLowerCase()),
    );

    if (match) {
      return { categoryId: match.categoryId, subcategoryId: match.subcategoryId };
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
