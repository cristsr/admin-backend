import { Field, InputType, OmitType, registerEnumType } from '@nestjs/graphql';
import { RegisterType } from '@admin-back/grpc';
import { User } from 'app/shared/dto';

@InputType()
export class RegisterInput extends OmitType(
  User,
  ['id', 'verified'],
  InputType
) {
  @Field(() => String)
  password: string;

  @Field(() => RegisterType)
  type: RegisterType;
}

registerEnumType(RegisterType, {
  name: 'RegisterType',
});
