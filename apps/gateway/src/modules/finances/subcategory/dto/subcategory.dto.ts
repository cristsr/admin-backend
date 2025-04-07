import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  Subcategories,
  SubcategoriesInput,
  Subcategory,
  SubcategoryInput,
} from '@core';
import { ListInput, ListObject } from '@shared';

@ObjectType(Subcategory.name)
export class SubcategoryImp implements Subcategory {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;
}

@InputType(SubcategoryInput.name)
export class SubcategoryInputImp implements SubcategoryInput {
  @Field({ nullable: true })
  id: number;

  @Field()
  name: string;

  @Field({ nullable: true })
  category: number;
}

@ObjectType()
export class SubcategoriesImp
  extends ListObject(SubcategoryImp)
  implements Subcategories {}

@InputType(SubcategoriesInput.name)
export class SubcategoriesInputImp
  extends ListInput(SubcategoryInputImp)
  implements SubcategoriesInput
{
  @Field()
  category: number;
}
