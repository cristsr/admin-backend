import { Injectable } from '@nestjs/common';
import {
  CategorizationRule,
  CategorizationRuleRepository,
} from '../../domain/categorization-rule';

@Injectable()
export class FindAllCategorizationRulesUsecase {
  constructor(private readonly ruleRepository: CategorizationRuleRepository) {}

  async execute(user: number): Promise<CategorizationRule[]> {
    return this.ruleRepository.findByUserOrderByPriorityDesc(user);
  }
}
