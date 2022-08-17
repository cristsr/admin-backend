import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ListInput, ListObject, OmitInputType } from '@admin-back/shared';

@ObjectType()
export class Subcategory {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;
}

@InputType()
export class CreateSubcategory extends OmitInputType(Subcategory, ['id']) {
  @Field({ nullable: true })
  category: number;
}

@InputType()
export class UpdateSubcategory extends OmitInputType(Subcategory, []) {}
// export class UpdateSubcategory extends Subcategory {}

@ObjectType()
export class Subcategories extends ListObject(Subcategory) {}

@InputType()
export class CreateSubcategories extends ListInput(
  OmitInputType(Subcategory, ['id'])
) {
  @Field()
  category: number;
}
