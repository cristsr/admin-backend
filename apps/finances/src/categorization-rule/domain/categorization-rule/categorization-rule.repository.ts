import { Criteria, Nullable } from '@shared';
import { CategorizationRuleField } from './categorization-rule.criteria';
import { CategorizationRule } from './categorization-rule.entity';

/**
 * Reads take a criteria; the questions themselves live in
 * `CategorizationRuleCriteria`, stated in domain terms.
 */
export abstract class CategorizationRuleRepository {
  abstract matching(
    criteria: Criteria<CategorizationRuleField>,
  ): Promise<CategorizationRule[]>;

  abstract firstMatching(
    criteria: Criteria<CategorizationRuleField>,
  ): Promise<Nullable<CategorizationRule>>;

  abstract save(rule: CategorizationRule): Promise<CategorizationRule>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(
    criteria: Criteria<CategorizationRuleField>,
  ): Promise<number>;
}
