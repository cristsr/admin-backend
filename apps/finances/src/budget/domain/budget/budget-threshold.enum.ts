/**
 * Spending threshold of a budget. Enum-like, stored as varchar; the allowed
 * values live in the application/domain layer, not in the DB.
 */
export enum BudgetThreshold {
  WARNING = 'WARNING',
  EXCEEDED = 'EXCEEDED',
}
