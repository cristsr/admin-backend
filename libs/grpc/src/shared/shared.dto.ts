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
