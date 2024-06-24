import { Field, ObjectType } from '@nestjs/graphql';
import { BaseModel } from '@admin-back/core';
import { TransformDate } from '@admin-back/shared';

@ObjectType()
export class GqlBaseResult implements BaseModel {
  @Field()
  id: number;

  @Field()
  active: boolean;

  @Field()
  @TransformDate()
  createdAt: Date;

  @Field({ nullable: true })
  @TransformDate()
  updatedAt: Date;

  @Field({ nullable: true })
  @TransformDate()
  deletedAt: Date;
}
