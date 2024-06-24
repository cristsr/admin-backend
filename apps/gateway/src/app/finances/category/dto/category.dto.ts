import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  Categories,
  CategoriesInput,
  Category,
  CategoryInput,
  GqlBaseResult,
} from '@admin-back/core';
import { ListInput, ListObject, OmitInputType } from '@admin-back/shared';
import {
  SubcategoryImp,
  SubcategoryInputImp,
} from 'app/finances/subcategory/dto';

@ObjectType()
export class CategoryImp extends GqlBaseResult implements Category {
  @Field()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsNotEmpty()
  icon: string;

  @Field()
  @IsNotEmpty()
  color: string;

  @Field(() => [SubcategoryImp])
  @Type(() => SubcategoryImp)
  @IsOptional()
  @IsArray({ each: true })
  @ValidateNested({ each: true })
  subcategories?: SubcategoryImp[];
}

// TODO: optimize this class to avid to use omitType
@InputType()
export class CategoryInputImp
  extends OmitInputType(CategoryImp, ['id', 'subcategories'])
  implements CategoryInput
{
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(0)
  id?: number;

  // TODO: replace subcategory to imp
  @Field(() => [SubcategoryInputImp], { nullable: true })
  @Type(() => SubcategoryInputImp)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  subcategories?: Omit<SubcategoryInputImp, 'category'>[];
}

@ObjectType()
export class CategoriesImp
  extends ListObject(CategoryImp)
  implements Categories {}

@InputType()
export class CategoriesInputImp
  extends ListInput(CategoryInputImp)
  implements CategoriesInput {}
