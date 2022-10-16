import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { CreateSubcategory, Subcategory } from '@admin-back/grpc';
import {
  ListInput,
  ListObject,
  OmitInputType,
  PartialInputType,
} from '@admin-back/shared';

@ObjectType()
export class Category {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  icon: string;

  @Field()
  color: string;

  @Field(() => [Subcategory])
  subcategories?: Subcategory[];
}

@InputType()
export class CreateCategory extends OmitInputType(Category, [
  'id',
  'subcategories',
]) {
  @Field(() => [CreateSubcategory], {
    nullable: true,
  })
  subcategories?: Omit<CreateSubcategory, 'category'>[];
}

@InputType()
export class UpdateCategory extends PartialInputType(
  OmitInputType(Category, ['subcategories'])
) {
  @Field(() => Int)
  id: number;
}

@ObjectType()
export class Categories extends ListObject(Category) {}

@InputType()
export class CreateCategories extends ListInput(CreateCategory) {}
