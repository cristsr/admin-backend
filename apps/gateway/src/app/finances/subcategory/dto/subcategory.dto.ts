import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  CreateSubcategories,
  Subcategories,
  Subcategory,
  SubcategoryInput,
} from '@admin-back/core';
import { ListInput, ListObject, OmitInputType } from '@admin-back/shared';

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

// TODO: remove this dto to centralize into save mutation
@InputType()
export class UpdateSubcategoryInput extends OmitInputType(SubcategoryImp, []) {
  @Field({ nullable: true })
  category?: number;
}

@ObjectType()
export class SubcategoriesImp
  extends ListObject(SubcategoryImp)
  implements Subcategories {}

@InputType()
export class CreateSubcategoriesImp
  extends ListInput(SubcategoryInputImp)
  implements CreateSubcategories
{
  @Field()
  category: number;
}
