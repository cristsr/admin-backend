import { BudgetThreshold } from '../enums/budget-threshold.enum';

export interface BudgetThresholdExceededPayload {
  budgetId: number;
  percentage: number;
  threshold: BudgetThreshold;
  user: number;
  correlationId?: string;
}
