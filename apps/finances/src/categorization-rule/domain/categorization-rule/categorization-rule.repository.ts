import { Nullable } from '@shared';
import { CategorizationRule } from './categorization-rule.entity';

export abstract class CategorizationRuleRepository {
  /** The user's rules ordered by priority descending (highest wins). */
  abstract findByUserOrderByPriorityDesc(
    user: number,
  ): Promise<CategorizationRule[]>;

  abstract findByIdAndUser(
    id: number,
    user: number,
  ): Promise<Nullable<CategorizationRule>>;

  abstract save(rule: CategorizationRule): Promise<CategorizationRule>;

  abstract softRemove(id: number, user: number): Promise<boolean>;
}
