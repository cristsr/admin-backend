import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';
import {
  ListObject,
  OmitInputType,
  PartialInputType,
} from '@admin-back/shared';
import { Category } from '../category';
import { Subcategory } from '../subcategory';
import { Account } from '../account';
import { MovementType, movementTypes } from './types';
import { Period, periods } from '../finances.types';

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

  categoryId: number;

  @Field()
  subcategory: Subcategory;

  subcategoryId: number;

  @Field()
  createdAt: string;

  account: Account;

  user: number;
}

@ObjectType()
export class Movements extends ListObject(Movement) {}

@InputType()
export class CreateMovement extends OmitInputType(Movement, [
  'id',
  'category',
  'subcategory',
  'createdAt',
  'account',
]) {
  @Field()
  category: number;

  @Field()
  subcategory: number;

  @Field()
  account: number;
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

  @Field(() => String, { nullable: true })
  order?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(movementTypes, { each: true })
  type?: MovementType[];
}
