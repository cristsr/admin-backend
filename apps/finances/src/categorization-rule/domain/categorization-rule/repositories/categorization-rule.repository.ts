import { Criteria, Nullable } from '@shared';
import { CategorizationRuleField } from '../criteria/categorization-rule-field.type';
import { CategorizationRule } from '../entities/categorization-rule.entity';

/** Queries are stated in domain terms via the `CategorizationRule*` criteria classes. */
export abstract class CategorizationRuleRepository {
  abstract matching(criteria: Criteria<CategorizationRuleField>): Promise<CategorizationRule[]>;

  abstract firstMatching(criteria: Criteria<CategorizationRuleField>): Promise<Nullable<CategorizationRule>>;

  abstract save(rule: CategorizationRule): Promise<CategorizationRule>;

  /** Soft-deletes every match and answers how many rows it touched. */
  abstract removeMatching(criteria: Criteria<CategorizationRuleField>): Promise<number>;
}
