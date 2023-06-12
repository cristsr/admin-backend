import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsDate, IsOptional } from 'class-validator';
import { OmitInputType, TransformDate } from '@admin-back/shared';
import { MovementType } from './movement.types';
import { Category } from '../category';
import { Subcategory } from '../subcategory';
import { Account } from '../account';
import { Period } from '../finances.constants';
import { BaseDto } from '../../shared';

@ObjectType()
export class Movement extends BaseDto {
  @Field(() => MovementType)
  type: MovementType;

  @Field()
  @TransformDate()
  date: Date;

  @Field()
  description: string;

  @Field()
  amount: number;

  @Field()
  category: Category;

  categoryId: number;

  @Field()
  subcategory: Subcategory;

  account: Account;

  user: number;
}

@InputType()
export class MovementInput extends OmitInputType(Movement, [
  'id',
  'category',
  'subcategory',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'account',
  'active',
]) {
  @Field({ nullable: true })
  id: number;

  @Field()
  @TransformDate()
  date: Date;

  @Field()
  category: number;

  @Field()
  subcategory: number;

  @Field()
  account: number;

  @Field({ nullable: true })
  active: boolean;
}

@InputType()
export class MovementFilter {
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

  @Field(() => Int, { nullable: true })
  category?: number;

  @Field(() => String, { nullable: true })
  order?: string;

  @Field(() => [MovementType], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  type?: MovementType[];
}
