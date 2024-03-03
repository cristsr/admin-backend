import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListInput, ListObject, OmitInputType } from '@admin-back/shared';
import { BaseDto } from '../../shared';
import { Subcategory, SubcategoryInput } from '../subcategory';

@ObjectType()
export class Category extends BaseDto {
  @Field()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsNotEmpty()
  icon: string;

  @Field()
  @IsNotEmpty()
  color: string;

  @Field(() => [Subcategory])
  @Type(() => Subcategory)
  @IsOptional()
  @IsArray({ each: true })
  @ValidateNested({ each: true })
  subcategories?: Subcategory[];
}

@InputType()
export class CategoryInput extends OmitInputType(Category, [
  'id',
  'subcategories',
]) {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(0)
  id?: number;

  @Field(() => [SubcategoryInput], { nullable: true })
  @Type(() => SubcategoryInput)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  subcategories?: Omit<SubcategoryInput, 'category'>[];
}

@ObjectType()
export class Categories extends ListObject(Category) {}

@InputType()
export class CategoriesInput extends ListInput(CategoryInput) {}
