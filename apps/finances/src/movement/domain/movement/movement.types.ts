export const movementTypes = ['INCOME', 'EXPENSE'] as const;

export enum MovementType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export interface MovementCategorySummary {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface MovementSubcategorySummary {
  id: number;
  name: string;
}

export interface MovementAccountSummary {
  id: number;
  name: string;
  initialBalance: number;
}
