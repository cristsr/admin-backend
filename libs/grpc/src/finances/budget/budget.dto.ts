import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Account } from '../account';
import { Category } from '../category';
import { BaseDto } from '../../shared';

@ObjectType()
export class Budget extends BaseDto {
  @Field()
  name: string;

  @Field()
  amount: number;

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field()
  repeat: boolean;

  @Field()
  active: boolean;

  @Field()
  spent: number;

  @Field()
  percentage: number;

  @Field(() => Category)
  category: Category;

  categoryId: number;

  account: Account;

  user: number;
}

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
