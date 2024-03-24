import { ENTRY_PROVIDER_WATERMARK } from '@nestjs/common/constants';
import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDate, IsOptional } from 'class-validator';
import {
  OmitInputType,
  ResolveEntity,
  ToEntity,
  TransformDate,
} from '@admin-back/shared';
import { BaseDto } from '../../shared';
import { Account } from '../account';
import { Category } from '../category';
import { Period } from '../finances.constants';
import { Subcategory } from '../subcategory';
import { MovementType } from './movement.types';

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

ENTRY_PROVIDER_WATERMARK;

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
@ResolveEntity()
export class MovementFilter {
  @ApiProperty({ enum: Period })
  @Field(() => Period)
  period: Period;

  @ApiProperty()
  @Field()
  @IsDate()
  @TransformDate()
  startDate: Date;

  @ApiProperty()
  @Field()
  @IsDate()
  @TransformDate()
  endDate: Date;

  @ApiProperty({ type: Number })
  @Field(() => ID, { nullable: true })
  @ToEntity(() => Account, { nullable: true })
  account?: Account;

  @ApiProperty({ type: Number })
  @Field(() => ID, { nullable: true })
  @ToEntity(() => Category, { nullable: false })
  category?: Category;

  @ApiProperty()
  @Field({ nullable: true })
  order?: string;

  @ApiProperty({ isArray: true, enum: MovementType })
  @Field(() => [MovementType], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  type?: MovementType[];
}
