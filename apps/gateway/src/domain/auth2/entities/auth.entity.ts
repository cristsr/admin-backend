import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Auth {
  @Field(() => String, { description: 'Example field (placeholder)' })
  email: string;

  @Field(() => String, { description: 'Example field (placeholder)' })
  password;

  @Field(() => String, { description: 'Example field (placeholder)' })
  type;
}

@ObjectType()
export class AuthRes {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  email: number;

  @Field(() => String, { description: 'Example field (placeholder)' })
  password;

  @Field(() => String, { description: 'Example field (placeholder)' })
  type;
}
