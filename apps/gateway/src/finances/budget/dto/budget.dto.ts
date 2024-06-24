import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Budget, BudgetFilter, BudgetInput, Period } from '@core';
import { TransformDate } from '@shared';
import { IsDate } from 'class-validator';
import { AccountImp } from 'app/finances/account/dto';
import { CategoryImp } from 'app/finances/category/dto/category.dto';
import { GqlBaseResult } from 'app/shared/dto';

@ObjectType(Budget.name)
export class BudgetImp extends GqlBaseResult implements Budget {
  @Field(() => AccountImp)
  account: AccountImp;

  @Field()
  amount: number;

  @Field(() => CategoryImp)
  category: CategoryImp;

  @Field()
  categoryId: number;

  @Field()
  name: string;

  @Field()
  percentage: number;

  @Field(() => Period)
  period: Period;

  @Field()
  repeat: boolean;

  @Field()
  spent: number;

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

@InputType(BudgetInput.name)
export class BudgetInputImp implements BudgetInput {
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

@InputType(BudgetFilter.name)
export class BudgetFilterImp implements BudgetFilter {
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
