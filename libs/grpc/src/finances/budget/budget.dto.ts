import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Account, Category } from '@admin-back/grpc';
import { ListObject } from '@admin-back/shared';

@ObjectType()
export class Budget {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field()
  amount: number;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field()
  spent: number;

  @Field()
  repeat: boolean;

  @Field()
  active: boolean;

  @Field()
  percentage: number;

  @Field(() => Category)
  category: Category;

  categoryId: number;

  account: Account;

  user: number;
}

@InputType()
export class Budgets extends ListObject(Budget) {}

@InputType()
export class BudgetInput {
  @Field({ nullable: true })
  id: number;

  @Field()
  name: string;

  @Field()
  amount: number;

  @Field()
  repeat: boolean;

  @Field()
  category: number;

  @Field()
  account: number;

  user: number;
}

@InputType()
export class BudgetFilter {
  @Field()
  account: number;

  user: number;
}
