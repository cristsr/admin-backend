import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => Int)
  id: number;

  @Field(() => String)
  username: string;

  // TODO: remove nullable
  @Field(() => String, {
    nullable: true,
  })
  name: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  verified: boolean;
}
