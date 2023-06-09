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
  closed: boolean;

  @Field({ nullable: true })
  closedAt: Date;

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

  @Field({ nullable: true })
  closed: boolean;

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
