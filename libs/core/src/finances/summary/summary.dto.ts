import { Category } from '../category';
import { Period } from '../finances.dto';

export class Expense {
  amount: number;

  percentage: number;

  category: Category;
}

export class ExpenseFilter {
  account: number;

  period: Period;

  startDate: Date;

  endDate: Date;

  user: number;
}

export class LastMovementFilter {
  account: number;

  user: number;
}
