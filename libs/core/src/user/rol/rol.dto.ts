import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ListObject, OmitInputType } from '@admin-back/shared';

@ObjectType()
export class Rol {
  @Field()
  id: number;

  @Field()
  name: string;

  @Field()
  active: boolean;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}

@ObjectType()
export class Roles extends ListObject(Rol) {}

@InputType()
export class CreateRol extends OmitInputType(Rol, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

@InputType()
export class UpdateRol extends OmitInputType(Rol, ['createdAt', 'updatedAt']) {}
