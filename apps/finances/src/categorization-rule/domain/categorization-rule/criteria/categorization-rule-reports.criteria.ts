import { Criteria, OrderType } from '@shared';
import { CategorizationRuleField } from './categorization-rule-field.type';
import { CategorizationRuleLookups } from './categorization-rule-lookups.criteria';

/** Collection queries that drive rule evaluation. */
export class CategorizationRuleReports {
  /** Evaluation order: highest priority first, oldest as deterministic tiebreak. */
  static byPriority(user: number): Criteria<CategorizationRuleField> {
    return CategorizationRuleLookups.ownedBy(user)
      .orderBy('priority', OrderType.DESC)
      .orderBy('id', OrderType.ASC);
  }
}
