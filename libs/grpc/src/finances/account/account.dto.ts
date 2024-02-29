import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsDate } from 'class-validator';
import { TransformDate } from '@admin-back/shared';
import { BaseDto } from '../../shared';
import { Period } from '../finances.constants';

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
  @Field({ nullable: true })
  balance: number;

  @Field({ nullable: true })
  incomes: number;

  @Field({ nullable: true })
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
