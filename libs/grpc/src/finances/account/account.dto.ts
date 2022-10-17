import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject } from '@admin-back/shared';
import { Relation } from 'typeorm';
import { IsIn } from 'class-validator';
import { Period, periods } from '../finances.types';

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
export class CreateAccount {
  @Field()
  name: string;

  @Field()
  initialBalance: number;

  user: number;
}

@InputType()
export class UpdateAccount {
  @Field()
  id: number;

  @Field()
  name: string;

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

export class Balances extends ListObject(Balance) {}

@InputType()
export class QueryBalance {
  @Field(() => String)
  @IsIn(periods)
  period: Period;

  @Field()
  date: string;

  @Field({ nullable: true })
  account: number;

  user: number;
}

@InputType()
export class QueryBalances {
  @Field()
  account: number;

  user: number;
}
