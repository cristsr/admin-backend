import { Field, ObjectType } from '@nestjs/graphql';
import { Category } from '@admin-back/grpc';

@ObjectType()
export class Expense {
  @Field()
  amount: number;

  @Field()
  percentage: number;

  @Field(() => Category)
  category: Category;
}

@ObjectType()
export class Expenses {
  @Field(() => [Expense])
  day: Expense[];

  @Field(() => [Expense])
  week: Expense[];

  @Field(() => [Expense])
  month: Expense[];
}

@ObjectType()
export class Balance {
  @Field()
  balance: number;

  @Field()
  incomeMonth: number;

  @Field()
  expenseMonth: number;

  @Field()
  incomeYear: number;

  @Field()
  expenseYear: number;
}
