import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';

interface ListMixin<T> {
  data: T[];
}

export function List<T>(classRef: Type<T>): Type<ListMixin<T>> {
  @ObjectType({ isAbstract: true })
  class BaseList {
    @Field(() => [classRef])
    data: T[];
  }

  return BaseList;
}
