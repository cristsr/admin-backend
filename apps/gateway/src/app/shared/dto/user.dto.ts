import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => String)
  username: string;

  @Field(() => String, {
    nullable: true,
  })
  name: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  verified: boolean;
}
