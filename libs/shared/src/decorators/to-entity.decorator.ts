import { Type } from '@nestjs/common';
import { WITH_ENTITY } from '../constants';

export interface Opts {
  nullable?: boolean;
  search?: string;
}

export function ToEntity(type: () => Type, opts?: Opts) {
  return (target: Record<any, any>, propertyKey: string) => {
    Reflect.defineMetadata(WITH_ENTITY, { type, opts }, target, propertyKey);
  };
}
