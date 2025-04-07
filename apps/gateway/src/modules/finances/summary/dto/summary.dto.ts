import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Expense, ExpenseFilter, LastMovementFilter, Period } from '@core';
import { TransformDate } from '@shared';
import { IsDate } from 'class-validator';
import { CategoryImp } from 'app/modules/finances/category/dto';

@ObjectType(Expense.name)
export class ExpenseImp implements Expense {
  @Field({ nullable: true })
  amount: number;

  @Field({ nullable: true })
  percentage: number;

  @Field(() => CategoryImp, { nullable: true })
  category: CategoryImp;
}

@InputType(ExpenseFilter.name)
export class ExpenseFilterImp implements ExpenseFilter {
  @Field()
  account: number;

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

  user: number;
}

@InputType(LastMovementFilter.name)
export class LastMovementFilterImp implements LastMovementFilter {
  @Field()
  account: number;

  // @Field()
  // date: string;

  user: number;
}
