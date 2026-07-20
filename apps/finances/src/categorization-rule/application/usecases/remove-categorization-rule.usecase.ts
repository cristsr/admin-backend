import { Injectable } from '@nestjs/common';
import {
  CategorizationRuleCriteria,
  CategorizationRuleNotFoundException,
  CategorizationRuleRepository,
} from '@app/categorization-rule/domain/categorization-rule';

@Injectable()
export class RemoveCategorizationRuleUsecase {
  constructor(private readonly ruleRepository: CategorizationRuleRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const removed = await this.ruleRepository.removeMatching(
      CategorizationRuleCriteria.byIdAndUser(id, user),
    );

    // Same 404 whether the rule never existed or belongs to another user.
    if (!removed) {
      throw new CategorizationRuleNotFoundException(
        'Categorization rule not found',
      );
    }

    return true;
  }
}
