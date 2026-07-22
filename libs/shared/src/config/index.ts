import { Type } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';
import { InvalidConfigurationException } from '../exceptions';

/** Read-only map of each key of T to itself. */
type Keys<T> = Readonly<{
  [key in keyof T]: key;
}>;

/**
 * Transforms and validates the config against the class. Any error is fatal:
 * the app must not boot on a config it could not validate.
 */
function configValidator(config: object, type: Type): Record<string, any> {
  const validatedConfig = plainToClass(type, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length) {
    const failures = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    throw new InvalidConfigurationException(`Invalid ${type.name}:\n  - ${failures.join('\n  - ')}`, {
      context: { invalid: errors.map((error) => error.property) },
    });
  }

  return validatedConfig;
}

/** Builds a reusable config validator bound to a class-validator-decorated class. */
export function validatorFactory(type: Type): (config: Record<string, any>) => Record<string, any> {
  return (config) => configValidator(config, type);
}

/** Derives a frozen key-to-key map from a class-validator-decorated class. */
export function mapEnvironmentKeys<T>(type: Type<T>): Keys<T> {
  const metadataStorage = getMetadataStorage();

  const targetMetadata = metadataStorage.getTargetValidationMetadatas(type, null, false, false);

  const entries = targetMetadata.map(({ propertyName }) => [propertyName, propertyName]);

  return Object.freeze(Object.fromEntries(entries));
}
