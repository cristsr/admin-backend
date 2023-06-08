import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Period } from '../finances.constants';

@ObjectType()
export class Account {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field()
  initialBalance: number;

  @Field()
  active: boolean;

  @Field({ nullable: true })
  createdAt: Date;

  @Field({ nullable: true })
  updatedAt: Date;

  @Field({ nullable: true })
  closedAt: Date;

  user: number;
}

@InputType()
export class AccountInput {
  @Field()
  name: string;

  @Field()
  initialBalance: number;

  user: number;
}

@ObjectType()
export class Balance {
  @Field()
  balance: number;

  @Field()
  incomes: number;

  @Field()
  expenses: number;
}

@InputType()
export class BalanceFilter {
  @Field(() => Period)
  period: Period;

  @Field()
  date: string;

  @Field({ nullable: true })
  account: number;

  user: number;
}
