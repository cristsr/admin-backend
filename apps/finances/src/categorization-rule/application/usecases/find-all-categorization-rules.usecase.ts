import { Injectable } from '@nestjs/common';
import {
  CategorizationRule,
  CategorizationRuleCriteria,
  CategorizationRuleRepository,
} from '@app/categorization-rule/domain/categorization-rule';

@Injectable()
export class FindAllCategorizationRulesUsecase {
  constructor(private readonly ruleRepository: CategorizationRuleRepository) {}

  async execute(user: number): Promise<CategorizationRule[]> {
    return this.ruleRepository.matching(
      CategorizationRuleCriteria.byPriority(user),
    );
  }
}
