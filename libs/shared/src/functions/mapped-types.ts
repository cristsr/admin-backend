import { Type } from '@nestjs/common';
import { InputType, ObjectType, OmitType } from '@nestjs/graphql';

export function OmitInputType<T, K extends keyof T>(
  classRef: Type<T>,
  keys: readonly K[] = []
): Type<Omit<T, typeof keys[number]>> {
  return OmitType<T, K>(classRef, keys, InputType);
}

export function OmitObjectType<T, K extends keyof T>(
  classRef: Type<T>,
  keys: readonly K[]
): Type<Omit<T, typeof keys[number]>> {
  return OmitType(classRef, keys, ObjectType);
}
