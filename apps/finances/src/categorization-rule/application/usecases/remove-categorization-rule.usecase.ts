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

    // A rule that matched nothing was never this user's to delete; the caller
    // gets the same 404 whether it never existed or belongs to somebody else.
    if (!removed) {
      throw new CategorizationRuleNotFoundException(
        'Categorization rule not found',
      );
    }

    return true;
  }
}
