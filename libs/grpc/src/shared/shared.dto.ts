import { Field, ObjectType } from '@nestjs/graphql';

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
  createdAt: Date;

  @Field({ nullable: true })
  updatedAt: Date;

  @Field({ nullable: true })
  deletedAt: Date;
}
