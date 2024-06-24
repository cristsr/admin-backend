import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GqlBaseResult } from '../../shared';
import { Period } from '../finances.constants';

// TODO: Create BaseModel instead of BaseResult
export class Account extends GqlBaseResult {
  name: string;

  initialBalance: number;

  user: number;
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
