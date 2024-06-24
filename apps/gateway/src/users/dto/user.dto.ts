import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { User, UserInput, Users } from '@core';
import { ListObject, OmitInputType } from '@shared';

@ObjectType(User.name)
export class UserImp implements User {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field()
  lastName: string;

  @Field()
  email: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  @Field()
  auth0Id: string;
}

@ObjectType(Users.name)
export class UsersImp extends ListObject(UserImp) implements Users {}

@InputType(UserInput.name)
export class UserInputImp
  extends OmitInputType(UserImp, ['id', 'createdAt', 'updatedAt'])
  implements UserInput {}

export class UserQuery {
  id?: number;
  email?: string;
  auth0Id?: string;
}
