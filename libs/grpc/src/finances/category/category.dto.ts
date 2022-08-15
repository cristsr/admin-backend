import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { CreateSubcategory, Subcategory } from '@admin-back/grpc';
import { List, OmitInputType, PartialInputType } from '@admin-back/shared';

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
  subcategories: Subcategory[];
}

@InputType()
export class CreateCategory extends OmitInputType(Category, [
  'id',
  'subcategories',
]) {
  @Field(() => [CreateSubcategory], { nullable: true })
  subcategories?: CreateSubcategory[];
}

@InputType()
export class UpdateCategory extends PartialInputType(CreateCategory) {
  @Field(() => Int)
  id: number;
}

@ObjectType()
export class Categories extends List(Category) {}

@InputType()
export class CreateCategories extends List(CreateCategory) {}
