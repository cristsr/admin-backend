import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { OmitInputType, PartialInputType } from '@admin-back/shared';

@ObjectType()
export class Subcategory {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;
}

@InputType()
export class CreateSubcategory extends OmitInputType(Subcategory, ['id']) {}

@InputType()
export class UpdateSubcategory extends PartialInputType(Subcategory) {}
