import { GqlBaseResult } from '../../shared';
import { Account } from '../account';
import { Category } from '../category';
import { Period } from '../finances.constants';

// TODO: replace GqlBaseResult
export class Budget extends GqlBaseResult {
  name: string;

  amount: number;

  startDate: Date;

  endDate: Date;

  repeat: boolean;

  active: boolean;

  period: Period;

  spent: number;

  percentage: number;

  category: Category;

  categoryId: number;

  account: Account;

  user: number;
}

export class BudgetInput {
  id: number;

  name: string;

  amount: number;

  repeat: boolean;

  category: number;

  account: number;

  startDate: Date;

  endDate: Date;

  user: number;
}

export class BudgetFilter {
  startDate: Date;

  endDate: Date;

  account: number;

  user: number;
}
