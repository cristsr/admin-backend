import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsDate } from 'class-validator';
import {
  Account,
  AccountFilter,
  AccountInput,
  Balance,
  BalanceFilter,
  GqlBaseResult,
  Period,
} from '@admin-back/core';
import { TransformDate } from '@admin-back/shared';

@ObjectType(Account.name)
export class AccountImp extends GqlBaseResult implements Account {
  @Field()
  initialBalance: number;

  @Field()
  name: string;

  @Field()
  user: number;
}

@InputType(AccountInput.name)
export class AccountInputImp implements AccountInput {
  @Field({ nullable: true })
  id: number;

  @Field({ nullable: true })
  name: string;

  @Field({ nullable: true })
  initialBalance: number;

  @Field({ nullable: true })
  active: boolean;

  user: number;
}

@InputType(AccountFilter.name)
export class AccountFilterImp implements AccountFilter {
  @Field({ nullable: true })
  active: boolean;

  user: number;
}

@ObjectType(Balance.name)
export class BalanceImp implements Balance {
  @Field({ nullable: true })
  balance: number;

  @Field({ nullable: true })
  incomes: number;

  @Field({ nullable: true })
  expenses: number;
}

@InputType(BalanceFilter.name)
export class BalanceFilterImp implements BalanceFilter {
  @Field(() => Period)
  period: Period;

  @Field()
  @IsDate()
  @TransformDate()
  startDate: Date;

  @Field()
  @IsDate()
  @TransformDate()
  endDate: Date;

  @Field({ nullable: true })
  account: number;

  user: number;
}
