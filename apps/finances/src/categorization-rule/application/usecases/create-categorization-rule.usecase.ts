import { Injectable } from '@nestjs/common';
import {
  CategoryNotFoundException,
  CategoryRepository,
} from '../../../category/domain/category';
import {
  CategorizationRule,
  CategorizationRuleRepository,
} from '../../domain/categorization-rule';
import { CategorizationRuleInputDto } from '../dto';

@Injectable()
export class CreateCategorizationRuleUsecase {
  constructor(
    private readonly ruleRepository: CategorizationRuleRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    input: CategorizationRuleInputDto,
    user: number,
  ): Promise<CategorizationRule> {
    const category = await this.categoryRepository.findById(input.categoryId);

    if (!category) {
      throw new CategoryNotFoundException(
        `Category ${input.categoryId} not found`,
      );
    }

    const rule = CategorizationRule.create({
      userId: user,
      pattern: input.pattern,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      priority: input.priority ?? 0,
    } as CategorizationRule);

    return this.ruleRepository.save(rule);
  }
}
