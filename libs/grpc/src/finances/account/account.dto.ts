import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject } from '@admin-back/shared';
import { Relation } from 'typeorm';

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
  user: number;

  account: number;

  @Field()
  dailyBalance: number;

  @Field()
  dailyIncomes: number;

  @Field()
  dailyExpenses: number;

  @Field()
  monthlyBalance: number;

  @Field()
  monthlyIncomes: number;

  @Field()
  monthlyExpenses: number;

  @Field()
  annualBalance: number;

  @Field()
  annualIncomes: number;

  @Field()
  annualExpenses: number;
}

@InputType()
export class QueryBalance {
  @Field()
  account: number;

  user: number;
}
