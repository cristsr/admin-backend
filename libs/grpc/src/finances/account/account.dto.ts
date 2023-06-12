import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { TransformDate } from '@admin-back/shared';
import { Period } from '../finances.constants';
import { BaseDto } from '../../shared';
import { IsDate } from 'class-validator';

@ObjectType()
export class Account extends BaseDto {
  @Field()
  name: string;

  @Field()
  initialBalance: number;

  user: number;
}

@InputType()
export class AccountInput {
  @Field({ nullable: true })
  id: number;

  @Field({ nullable: true })
  name: string;

  @Field({ nullable: true })
  initialBalance: number;

  @Field({ nullable: true })
  active: boolean;

  user: number;
}

@InputType()
export class AccountFilter {
  @Field({ nullable: true })
  active: boolean;

  user: number;
}

@ObjectType()
export class Balance {
  @Field()
  balance: number;

  @Field()
  incomes: number;

  @Field()
  expenses: number;
}

@InputType()
export class BalanceFilter {
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

  @Field({ nullable: true })
  account: number;

  user: number;
}
