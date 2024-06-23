import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsDate } from 'class-validator';
import { TransformDate } from '@admin-back/shared';
import { Category } from '../category';
import { Period } from '../finances.constants';

@ObjectType()
export class Expense {
  @Field({ nullable: true })
  amount: number;

  @Field({ nullable: true })
  percentage: number;

  @Field(() => Category, { nullable: true })
  category: Category;
}

@InputType()
export class ExpenseFilter {
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

@InputType()
export class LastMovementFilter {
  @Field()
  account: number;

  // @Field()
  // date: string;

  user: number;
}
