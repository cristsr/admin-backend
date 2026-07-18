import { BudgetThreshold, BudgetThresholdExceededPayload } from '../domain/budget';

export { BudgetThreshold, BudgetThresholdExceededPayload };

export const GenerateBudgets = 'budget.generate';

export const BudgetThresholdExceeded = 'budget.threshold-exceeded';

/** Percentage of the budget's amount at which each threshold fires. */
export const BUDGET_THRESHOLD_LIMITS: Record<BudgetThreshold, number> = {
  [BudgetThreshold.WARNING]: 80,
  [BudgetThreshold.EXCEEDED]: 100,
};
