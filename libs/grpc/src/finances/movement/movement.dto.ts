import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Category } from '../category';
import { Subcategory } from '../subcategory';
import {
  ListObject,
  OmitInputType,
  PartialInputType,
} from '@admin-back/shared';
import { ArrayMaxSize, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { MovementType, Period, periods } from './types';

@ObjectType()
export class Movement {
  @Field()
  id: number;

  @Field(() => String)
  type: MovementType;

  @Field()
  date: string;

  @Field()
  description: string;

  @Field()
  amount: number;

  @Field()
  category: Category;

  @Field()
  subcategory: Subcategory;

  @Field()
  createdAt: string;
}

@ObjectType()
export class Movements extends ListObject(Movement) {}

@InputType()
export class CreateMovement extends OmitInputType(Movement, [
  'id',
  'category',
  'subcategory',
  'createdAt',
]) {
  @Field()
  category: number;

  @Field()
  subcategory: number;
}

@InputType()
export class UpdateMovement extends PartialInputType(CreateMovement) {
  @Field()
  id: number;
}

@InputType()
export class MovementFilter {
  @Field()
  @IsIn(periods)
  period: Period;

  @Field()
  date: string;

  @Field(() => Int, { nullable: true })
  category?: number;

  // Todo: validate frontend
  @Field(() => [String], { nullable: true })
  @Transform(({ value }) => [...new Set(...value)])
  @IsIn(['income', 'expense'])
  @ArrayMaxSize(2)
  type: MovementType[];
}
