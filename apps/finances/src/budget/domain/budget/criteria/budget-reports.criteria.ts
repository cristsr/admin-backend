import { Criteria } from '@shared';
import { BudgetField } from './budget-field.type';
import { BudgetLookups } from './budget-lookups.criteria';

/** Collection queries that drive budget matching and regeneration. */
export class BudgetReports {
  /**
   * Budgets a movement must be counted against: same user, category and
   * account, with `date` inside the period. Several may match.
   */
  static activeCovering(params: {
    user: number;
    category: number;
    account: number;
    date: Date;
  }): Criteria<BudgetField> {
    return BudgetLookups.ownedBy(params.user)
      .equals('category', params.category)
      .equals('account', params.account)
      .equals('isActive', true)
      .lessOrEqual('startDate', params.date)
      .greaterOrEqual('endDate', params.date);
  }

  /** Repeating budgets whose period has closed; not scoped to a user. */
  static dueForRegeneration(now: Date): Criteria<BudgetField> {
    return Criteria.none<BudgetField>()
      .equals('isActive', true)
      .equals('repeat', true)
      .lessOrEqual('endDate', now);
  }
}
