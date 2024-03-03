import { ENTRY_PROVIDER_WATERMARK } from '@nestjs/common/constants';
import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsDate, IsOptional } from 'class-validator';
import {
  OmitInputType,
  ResolveEntity,
  ToEntity,
  TransformDate,
} from '@admin-back/shared';
import { AccountEntity } from '../../../../../apps/finances/src/app/account/entities';
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

  @Field(() => ID, { nullable: true })
  @ToEntity(() => Account, { nullable: true })
  account?: Account;

  @Field(() => ID, { nullable: true })
  @ToEntity(() => Category, { nullable: false })
  category?: Category;

  @Field({ nullable: true })
  order?: string;

  @Field(() => [MovementType], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  type?: MovementType[];
}
