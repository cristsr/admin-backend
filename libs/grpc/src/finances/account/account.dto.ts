import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject } from '@admin-back/shared';
import { Relation } from 'typeorm';
import { IsIn } from 'class-validator';
import { Period, periods } from '../finances.constants';

@ObjectType()
export class Account {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field(() => Balance)
  balance?: Relation<Balance>;

  @Field()
  initialBalance: number;

  @Field()
  active: boolean;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;

  @Field({ nullable: true })
  closedAt: string;

  user: number;
}

export class Accounts extends ListObject(Account) {}

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
  @Field(() => String)
  @IsIn(periods)
  period: Period;

  @Field()
  date: string;

  @Field({ nullable: true })
  account: number;

  user: number;
}
