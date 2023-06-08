import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsDateString } from '@admin-back/shared';
import { Period } from '../finances.constants';
import { BaseDto } from '../../shared';

@ObjectType()
export class Account extends BaseDto {
  @Field()
  name: string;

  @Field()
  initialBalance: number;

  @Field()
  active: boolean;

  @Field({ nullable: true })
  closedAt: Date;

  user: number;
}

@InputType()
export class AccountInput {
  @Field()
  name: string;

  @Field()
  initialBalance: number;

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
  @IsDateString()
  date: string;

  @Field({ nullable: true })
  account: number;

  user: number;
}
