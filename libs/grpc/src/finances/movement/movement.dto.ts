import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';
import {
  ListObject,
  OmitInputType,
  PartialInputType,
} from '@admin-back/shared';
import { Category } from '../category';
import { Subcategory } from '../subcategory';
import { MovementType, movementTypes, Period, periods } from './types';

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
  @Field(() => String)
  @IsIn(periods)
  period: Period;

  @Field()
  date: string;

  @Field(() => Int, { nullable: true })
  category?: number;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(movementTypes, { each: true })
  type?: MovementType[];
}
