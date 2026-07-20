import { Criteria, OrderType } from '@shared';

/** Every categorization-rule attribute a criteria may name. */
export type CategorizationRuleField =
  | 'id'
  | 'user'
  | 'pattern'
  | 'category'
  | 'subcategory'
  | 'priority'
  | 'createdAt';

/**
 * Named queries over categorization rules. No HTTP schema: rules are always
 * listed whole for their owner.
 */
export class CategorizationRuleCriteria {
  static ownedBy(user: number): Criteria<CategorizationRuleField> {
    return Criteria.none<CategorizationRuleField>().equals('user', user);
  }

  static byIdAndUser(
    id: number,
    user: number,
  ): Criteria<CategorizationRuleField> {
    return CategorizationRuleCriteria.ownedBy(user).equals('id', id);
  }

  /** Evaluation order: highest priority first, oldest as deterministic tiebreak. */
  static byPriority(user: number): Criteria<CategorizationRuleField> {
    return CategorizationRuleCriteria.ownedBy(user)
      .orderBy('priority', OrderType.DESC)
      .orderBy('id', OrderType.ASC);
  }
}
