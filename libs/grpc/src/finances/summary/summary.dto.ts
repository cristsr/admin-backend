import { Field, InputType, ObjectType } from '@nestjs/graphql';
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
  @Field(() => Period)
  period: Period;

  @Field()
  date: string;
}

@InputType()
export class LastMovementFilter {
  @Field()
  account: number;

  // @Field()
  // date: string;

  user: number;
}
