import { Type } from '@nestjs/common';
import { Field, InputType, ObjectType } from '@nestjs/graphql';

export interface ListMixin<T> {
  data: T[];
}

export function ListInput<T>(classRef: Type<T>): Type<ListMixin<T>> {
  @InputType({ isAbstract: true })
  class BaseList {
    @Field(() => [classRef])
    data: T[];
  }

  return BaseList;
}

export function ListObject<T>(classRef: Type<T>): Type<ListMixin<T>> {
  @ObjectType({ isAbstract: true })
  class BaseList {
    @Field(() => [classRef])
    data: T[];
  }

  return BaseList;
}
