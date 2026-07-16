export const GenerateBudgets = 'budget.generate';

export const BudgetThresholdExceeded = 'budget.threshold-exceeded';

export enum BudgetThreshold {
  WARNING = 'WARNING',
  EXCEEDED = 'EXCEEDED',
}

export interface BudgetThresholdExceededPayload {
  budgetId: number;
  percentage: number;
  threshold: BudgetThreshold;
  user: number;
}

/** Percentage of the budget's amount at which each threshold fires. */
export const BUDGET_THRESHOLD_LIMITS: Record<BudgetThreshold, number> = {
  [BudgetThreshold.WARNING]: 80,
  [BudgetThreshold.EXCEEDED]: 100,
};
