import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Categories, CategoriesInput, Category, CategoryInput } from '@core';
import { ListInput, ListObject } from '@shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SubcategoryImp,
  SubcategoryInputImp,
} from 'app/modules/finances/subcategory/dto';
import { GqlBaseResult } from 'app/shared/dto';

@ObjectType(Category.name)
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

@InputType(CategoryInput.name)
export class CategoryInputImp implements CategoryInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(0)
  id?: number;

  @Field()
  active: boolean;

  @Field()
  color: string;

  @Field()
  icon: string;

  @Field()
  name: string;

  @Field(() => [SubcategoryInputImp], { nullable: true })
  @Type(() => SubcategoryInputImp)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  subcategories?: Omit<SubcategoryInputImp, 'category'>[];
}

@ObjectType(Categories.name)
export class CategoriesImp
  extends ListObject(CategoryImp)
  implements Categories {}

@InputType(CategoriesInput.name)
export class CategoriesInputImp
  extends ListInput(CategoryInputImp)
  implements CategoriesInput {}
