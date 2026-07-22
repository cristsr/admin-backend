import { CriteriaSchema, CriteriaValueType, IDENTITY_OPERATORS } from '@shared';
import { BudgetField } from './budget-field.type';

/**
 * `user` and `isActive` are excluded on purpose: ownership is pinned by the
 * use case and superseded periods must stay out of caller-driven queries.
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
