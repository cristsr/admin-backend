import { BaseModel } from '../../shared';
import { Period } from '../finances.dto';

export class Account extends BaseModel {
  name: string;

  initialBalance: number;

  user: number;

  constructor(args: Partial<Account>) {
    super();
    Object.assign(this, args);
  }
}

export class AccountInput {
  id: number;

  name: string;

  initialBalance: number;

  active: boolean;

  user: number;
}

export class AccountFilter {
  active: boolean;

  user: number;
}

export class Balance {
  balance: number;

  incomes: number;

  expenses: number;
}

export class BalanceFilter {
  period: Period;

  startDate: Date;

  endDate: Date;

  account: number;

  user: number;
}
