import { Field, InputType, OmitType, registerEnumType } from '@nestjs/graphql';
import { RegisterType } from '@admin-back/shared';
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
