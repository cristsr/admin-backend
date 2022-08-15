import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';

export function List<T>(classRef: Type<T>) {
  @ObjectType({ isAbstract: true })
  class BaseList {
    @Field(() => [classRef])
    data: T[];
  }

  return BaseList;
}
