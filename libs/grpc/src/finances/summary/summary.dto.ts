import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Category, Period, periods } from '@admin-back/grpc';
import { IsIn } from 'class-validator';
import { ListObject } from '@admin-back/shared';

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
export class Expenses extends ListObject(Expense) {}

@InputType()
export class ExpenseFilter {
  @Field(() => String)
  @IsIn(periods)
  period: Period;

  @Field()
  date: string;
}
