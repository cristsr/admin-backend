import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Status {
  @Field()
  status: boolean;
}

export class BaseModel {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;
}
