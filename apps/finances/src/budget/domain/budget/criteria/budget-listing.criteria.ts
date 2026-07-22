import { Criteria, CriteriaQueryDto, Nullable, OrderType, criteriaFromQuery } from '@shared';
import { BUDGET_CRITERIA_SCHEMA } from './budget-criteria.schema';
import { BudgetField } from './budget-field.type';
import { BudgetLookups } from './budget-lookups.criteria';

/** The user-facing budget listing driven by a REST query string. */
export class BudgetListing {
  /** The user's budgets for the period in force; history stays out. */
  static fromQuery(query: Nullable<CriteriaQueryDto>, user: number): Criteria<BudgetField> {
    return criteriaFromQuery(
      query,
      BUDGET_CRITERIA_SCHEMA,
      BudgetLookups.ownedBy(user).equals('isActive', true),
    ).orderByDefault({ field: 'startDate', type: OrderType.DESC });
  }
}
