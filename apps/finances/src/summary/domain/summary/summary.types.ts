import { MovementCategorySummary } from '@app/movement/domain/movement';

export interface Balance {
  balance: number;

  incomes: number;

  expenses: number;
}

export interface Expense {
  amount: number;

  percentage: number;

  category?: MovementCategorySummary;
}

export interface BalanceQuery {
  startDate: Date;

  endDate: Date;

  account: number;

  user: number;
}

export interface ExpenseQuery {
  account: number;

  startDate: Date;

  endDate: Date;

  user: number;
}

export interface LastMovementsQuery {
  account: number;

  user: number;
}
