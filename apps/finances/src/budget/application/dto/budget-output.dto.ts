import { Period } from '@app/budget/domain/budget';

export class BudgetOutputDto {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  name: string;

  amount: number;

  currency: string;

  startDate: Date;

  endDate: Date;

  repeat: boolean;

  period: Period;

  categoryId: number;

  accountId: number;

  user: number;

  spent: number;

  percentage: number;
}
