import {
  Criteria,
  CriteriaQueryDto,
  CriteriaSchema,
  CriteriaValueType,
  IDENTITY_OPERATORS,
  Nullable,
  OrderType,
  criteriaFromQuery,
} from '@shared';

/** Every budget attribute a criteria may name. */
export type BudgetField =
  | 'id'
  | 'user'
  | 'account'
  | 'category'
  | 'name'
  | 'isActive'
  | 'repeat'
  | 'period'
  | 'startDate'
  | 'endDate'
  | 'amount'
  | 'currency'
  | 'createdAt';

/**
 * `user` and `isActive` are absent on purpose. Ownership is pinned by the use
 * case, and a caller must not be able to resurrect superseded periods: rolled
 * over budgets are kept as history, not as something to list.
 */
export const BUDGET_CRITERIA_SCHEMA: CriteriaSchema<BudgetField> = {
  name: { type: CriteriaValueType.STRING, isSortable: true },
  startDate: { type: CriteriaValueType.DATE, isSortable: true },
  endDate: { type: CriteriaValueType.DATE, isSortable: true },
  amount: { type: CriteriaValueType.NUMBER, isSortable: true },
  currency: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  period: { type: CriteriaValueType.STRING, operators: IDENTITY_OPERATORS },
  repeat: { type: CriteriaValueType.BOOLEAN },
  account: { type: CriteriaValueType.NUMBER, operators: IDENTITY_OPERATORS },
  category: { type: CriteriaValueType.NUMBER, operators: IDENTITY_OPERATORS },
  createdAt: { type: CriteriaValueType.DATE, isSortable: true },
};

/** Named queries over budgets. */
export class BudgetCriteria {
  static ownedBy(user: number): Criteria<BudgetField> {
    return Criteria.none<BudgetField>().equals('user', user);
  }

  static byIdAndUser(id: number, user: number): Criteria<BudgetField> {
    return BudgetCriteria.ownedBy(user).equals('id', id);
  }

  /** The user's budgets for the period in force; history stays out. */
  static list(
    query: Nullable<CriteriaQueryDto>,
    user: number,
  ): Criteria<BudgetField> {
    const criteria = criteriaFromQuery(
      query,
      BUDGET_CRITERIA_SCHEMA,
      BudgetCriteria.ownedBy(user).equals('isActive', true),
    );

    return criteria.hasOrders
      ? criteria
      : criteria.orderBy('startDate', OrderType.DESC);
  }

  /**
   * The budgets a movement has to be counted against: same user, category and
   * account, with `date` inside the period. Several may match — a user can run
   * a weekly and a monthly budget over the same category.
   */
  static activeCovering(params: {
    user: number;
    category: number;
    account: number;
    date: Date;
  }): Criteria<BudgetField> {
    return BudgetCriteria.ownedBy(params.user)
      .equals('category', params.category)
      .equals('account', params.account)
      .equals('isActive', true)
      .lessOrEqual('startDate', params.date)
      .greaterOrEqual('endDate', params.date);
  }

  /**
   * Repeating budgets whose period has closed, so the cron can roll them into
   * the next one. Not scoped to a user: the job renews everybody's.
   */
  static dueForRegeneration(now: Date): Criteria<BudgetField> {
    return Criteria.none<BudgetField>()
      .equals('isActive', true)
      .equals('repeat', true)
      .lessOrEqual('endDate', now);
  }
}
