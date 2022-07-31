import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { User } from 'app/shared/dto';

@InputType()
export class LoginInput {
  @Field(() => String)
  email: string;

  @Field(() => String)
  password: string;
}

@ObjectType()
export class Credential {
  @Field(() => String)
  value: string;

  @Field(() => Int)
  expires: number;
}

@ObjectType()
export class Credentials {
  @Field(() => Credential)
  accessToken: string;

  @Field(() => Credential)
  refreshToken: string;
}

@ObjectType()
export class LoginRes {
  @Field(() => User)
  user: User;

  @Field(() => Credentials)
  credentials: Credentials;
}
