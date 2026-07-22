import { Criteria } from '@shared';
import { CategorizationRuleField } from './categorization-rule-field.type';

/** Identity and ownership lookups over the caller's categorization rules. */
export class CategorizationRuleLookups {
  static ownedBy(user: number): Criteria<CategorizationRuleField> {
    return Criteria.none<CategorizationRuleField>().equals('user', user);
  }

  static byIdAndUser(id: number, user: number): Criteria<CategorizationRuleField> {
    return CategorizationRuleLookups.ownedBy(user).equals('id', id);
  }
}
