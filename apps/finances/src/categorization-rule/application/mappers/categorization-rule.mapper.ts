import { CategorizationRule } from '../../domain/categorization-rule';
import { CategorizationRuleOutputDto } from '../dto';

export class CategorizationRuleMapper {
  static toOutput(rule: CategorizationRule): CategorizationRuleOutputDto {
    return {
      id: rule.id,
      pattern: rule.pattern,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      priority: rule.priority,
      createdAt: rule.createdAt,
    };
  }
}
