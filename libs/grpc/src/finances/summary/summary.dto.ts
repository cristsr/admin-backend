import { Field, ObjectType } from '@nestjs/graphql';
import { Category } from '@admin-back/grpc';

@ObjectType()
export class Expense {
  @Field({ nullable: true })
  amount: number;

  @Field({ nullable: true })
  percentage: number;

  @Field(() => Category, { nullable: true })
  category: Category;
}

@ObjectType()
export class Expenses {
  @Field(() => [Expense], { nullable: true })
  day: Expense[];

  @Field(() => [Expense], { nullable: true })
  week: Expense[];

  @Field(() => [Expense], { nullable: true })
  month: Expense[];
}

@ObjectType()
export class Balance {
  @Field({ nullable: true })
  balance: number;

  @Field({ nullable: true })
  incomeMonth: number;

  @Field({ nullable: true })
  expenseMonth: number;

  @Field({ nullable: true })
  incomeYear: number;

  @Field({ nullable: true })
  expenseYear: number;
}
