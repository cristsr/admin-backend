import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class Login2Req {
  @Field(() => String)
  email: string;

  @Field(() => String)
  password: string;
}
