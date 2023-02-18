import { Logger, Type } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';

export type Keys<T> = Readonly<{
  [key in keyof T]: key;
}>;

export function configValidator(
  config: object,
  type: Type
): Record<string, any> {
  const logger = new Logger(configValidator.name);

  const validatedConfig = plainToClass(type, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length) {
    errors
      .map((error) => error.constraints)
      .map((constraints) => Object.values(constraints))
      .forEach(([v]) => logger.warn(v));

    return config;
  }

  return validatedConfig;
}

export function validatorFactory(type: Type): (config) => Record<string, any> {
  return (config) => configValidator(config, type);
}

export function mapEnvironmentKeys<T>(type: Type<T>): Keys<T> {
  const metadataStorage = getMetadataStorage();

  const targetMetadata = metadataStorage.getTargetValidationMetadatas(
    type,
    null,
    false,
    false
  );

  const entries = targetMetadata.map(({ propertyName }) => [
    propertyName,
    propertyName,
  ]);

  return Object.freeze(Object.fromEntries(entries));
}
