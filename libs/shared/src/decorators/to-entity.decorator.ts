import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WITH_ENTITY } from '../constants';

export interface Opts {
  nullable?: boolean;
  search?: string;
}

export function ToEntity(type: () => Function, opts?: Opts) {
  return (target: Record<any, any>, propertyKey: string) => {
    Reflect.defineMetadata(WITH_ENTITY, { type, opts }, target, propertyKey);
  };
}
