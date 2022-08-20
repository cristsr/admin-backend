import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Category } from '@admin-back/grpc';
import {
  ListObject,
  OmitInputType,
  PartialInputType,
} from '@admin-back/shared';

@ObjectType()
export class Budget {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field()
  amount: number;

  @Field()
  spent: number;

  @Field()
  repeat: boolean;

  @Field()
  active: boolean;

  @Field()
  percentage: number;

  @Field(() => Category)
  category: Category;
}

@InputType()
export class Budgets extends ListObject(Budget) {}

@InputType()
export class CreateBudget extends OmitInputType(Budget, [
  'id',
  'startDate',
  'endDate',
  'spent',
  'percentage',
  'category',
  'active',
]) {
  @Field()
  category: number;
}

@InputType()
export class UpdateBudget extends PartialInputType(CreateBudget) {
  @Field()
  id: number;
}
