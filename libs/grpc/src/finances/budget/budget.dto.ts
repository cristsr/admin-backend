import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Account } from '../account';
import { Category } from '../category';
import { BaseDto } from '../../shared';
import { IsDate } from 'class-validator';
import { TransformDate } from '@admin-back/shared';
import { Period } from '../finances.constants';

@ObjectType()
export class Budget extends BaseDto {
  @Field()
  name: string;

  @Field()
  amount: number;

  @Field()
  @TransformDate()
  startDate: Date;

  @Field()
  @TransformDate()
  endDate: Date;

  @Field()
  repeat: boolean;

  @Field()
  active: boolean;

  @Field(() => Period)
  period: Period;

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
export class BudgetFilter {
  @Field()
  @IsDate()
  @TransformDate()
  startDate: Date;

  @Field()
  @IsDate()
  @TransformDate()
  endDate: Date;

  @Field()
  account: number;

  user: number;
}
