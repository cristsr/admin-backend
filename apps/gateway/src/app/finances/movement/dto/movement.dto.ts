import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDate, IsOptional } from 'class-validator';
import {
  Movement,
  MovementFilter,
  MovementInput,
  MovementType,
  Period,
} from '@admin-back/core';
import { ResolveEntity, TransformDate } from '@admin-back/shared';
import { AccountImp } from 'app/finances/account/dto';
import { CategoryImp } from 'app/finances/category/dto';
import { SubcategoryImp } from 'app/finances/subcategory/dto';
import { GqlBaseResult } from 'app/shared/dto';

@ObjectType(Movement.name)
export class MovementImp extends GqlBaseResult implements Movement {
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
  category: CategoryImp;

  @Field()
  subcategory: SubcategoryImp;

  account: AccountImp;

  user: number;
}

@InputType(MovementInput.name)
export class MovementInputImp implements MovementInput {
  @Field({ nullable: true })
  id: number;

  @Field()
  @IsDate()
  @TransformDate()
  date: Date;

  @Field()
  category: number;

  @Field()
  subcategory: number;

  @Field()
  account: number;

  @Field()
  amount: number;

  @Field()
  categoryId: number;

  @Field()
  description: string;

  @Field(() => MovementType)
  type: MovementType;

  user: number;
}

// TODO replace resolve entity with entity validator
@InputType(MovementFilter.name)
@ResolveEntity()
export class MovementFilterImp implements MovementFilter {
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
  account?: number;

  @Field(() => ID, { nullable: true })
  category?: number;

  @ApiProperty()
  @Field({ nullable: true })
  order?: string;

  @Field(() => [MovementType], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  type?: MovementType[];
}
