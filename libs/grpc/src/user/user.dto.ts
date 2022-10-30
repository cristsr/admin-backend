import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject, OmitInputType } from '@admin-back/shared';

@ObjectType()
export class User {
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

@ObjectType()
export class Users extends ListObject(User) {}

@InputType()
export class UserInput extends OmitInputType(User, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

@InputType()
export class UpdateUser extends OmitInputType(User, [
  'createdAt',
  'updatedAt',
]) {}

export class UserQuery {
  id?: number;
  email?: string;
  auth0Id?: string;
}
