import { defaultMetadataStorage } from 'class-transformer/types/storage';
import { registerDecorator } from 'class-validator';
import { ValidationOptions } from 'class-validator/types/decorator/ValidationOptions';
import { EntityConstraint } from '../constraints';

type Opts = ValidationOptions;

export function HasEntity(target: () => Function, options?: Opts) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'custom',
      target: object.constructor,
      propertyName: propertyName,
      options,
      constraints: [target],
      validator: EntityConstraint,
      async: true,
    });
  };
}
