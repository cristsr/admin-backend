import { Injectable } from '@nestjs/common';
import {
  CategorizationRule,
  CategorizationRuleRepository,
} from '@app/categorization-rule/domain/categorization-rule';
import {
  CategoryCriteria,
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
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
    const category = await this.categoryRepository.firstMatching(
      CategoryCriteria.byId(input.categoryId),
    );

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
