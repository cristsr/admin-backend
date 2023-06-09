import { Field, ObjectType } from '@nestjs/graphql';
import { TransformDate } from '@admin-back/shared';

@ObjectType()
export class Status {
  @Field()
  status: boolean;
}

@ObjectType()
export class Message {
  @Field()
  message: string;
}

@ObjectType()
export class BaseDto {
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

  constructor(partial: Record<any, any>) {
    Object.assign(this, partial);
  }
}
