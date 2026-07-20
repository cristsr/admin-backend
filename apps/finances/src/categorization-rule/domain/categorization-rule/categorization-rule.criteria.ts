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
 * Named queries over categorization rules. There is no HTTP schema: rules are
 * always listed whole for their owner, never filtered from the query string.
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

  /**
   * The user's rules in the order they must be evaluated: highest priority
   * first, then oldest, so two rules with the same priority always resolve the
   * same way instead of depending on how the database felt about it.
   */
  static byPriority(user: number): Criteria<CategorizationRuleField> {
    return CategorizationRuleCriteria.ownedBy(user)
      .orderBy('priority', OrderType.DESC)
      .orderBy('id', OrderType.ASC);
  }
}
