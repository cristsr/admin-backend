import { Criteria } from '@shared';
import { BudgetField } from './budget-field.type';

/** Identity and ownership lookups over the caller's budgets. */
export class BudgetLookups {
  static ownedBy(user: number): Criteria<BudgetField> {
    return Criteria.none<BudgetField>().equals('user', user);
  }

  static byIdAndUser(id: number, user: number): Criteria<BudgetField> {
    return BudgetLookups.ownedBy(user).equals('id', id);
  }
}
