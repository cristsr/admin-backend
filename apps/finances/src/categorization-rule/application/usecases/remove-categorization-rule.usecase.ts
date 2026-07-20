import { Injectable } from '@nestjs/common';
import {
  CategorizationRuleNotFoundException,
  CategorizationRuleRepository,
} from '@app/categorization-rule/domain/categorization-rule';

@Injectable()
export class RemoveCategorizationRuleUsecase {
  constructor(private readonly ruleRepository: CategorizationRuleRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const rule = await this.ruleRepository.findByIdAndUser(id, user);

    if (!rule) {
      throw new CategorizationRuleNotFoundException(
        'Categorization rule not found',
      );
    }

    return this.ruleRepository.softRemove(id, user);
  }
}
