import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject, OmitInputType } from '@admin-back/shared';

@ObjectType()
export class User {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field()
  lastname: string;

  @Field()
  email: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}

@ObjectType()
export class Users extends ListObject(User) {}

@InputType()
export class CreateUser extends OmitInputType(User, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

@InputType()
export class UpdateUser extends OmitInputType(User, [
  'createdAt',
  'updatedAt',
]) {}
