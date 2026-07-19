import { Injectable } from '@nestjs/common';
import {
  CategorizationRule,
  CategorizationRuleNotFoundException,
  CategorizationRuleRepository,
} from '../../domain/categorization-rule';
import { CategorizationRuleUpdateInputDto } from '../dto';

@Injectable()
export class UpdateCategorizationRuleUsecase {
  constructor(private readonly ruleRepository: CategorizationRuleRepository) {}

  async execute(
    id: number,
    input: CategorizationRuleUpdateInputDto,
    user: number,
  ): Promise<CategorizationRule> {
    const rule = await this.ruleRepository.findByIdAndUser(id, user);

    if (!rule) {
      throw new CategorizationRuleNotFoundException(
        'Categorization rule not found',
      );
    }

    rule.update({
      pattern: input.pattern ?? rule.pattern,
      categoryId: input.categoryId ?? rule.categoryId,
      subcategoryId: input.subcategoryId ?? rule.subcategoryId,
      priority: input.priority ?? rule.priority,
    });

    return this.ruleRepository.save(rule);
  }
}
