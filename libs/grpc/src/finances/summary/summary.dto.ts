import { Field, ObjectType } from '@nestjs/graphql';
import { Category, Period, periods } from '@admin-back/grpc';
import { IsIn } from 'class-validator';

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

export class QueryExpense {
  @Field(() => String)
  @IsIn(periods)
  period: Period;
}
