/**
 * Utilities for validating configuration objects and introspecting configuration keys.
 *
 * This module provides:
 * - A validatorFactory that builds a reusable configuration validator function
 *   for a given class (Type) annotated with class-validator decorators.
 * - A mapEnvironmentKeys helper that derives a read-only map of property names
 *   from class-validator metadata, useful for enumerating expected environment/config keys.
 *
 * Implementation details:
 * - Uses NestJS Logger for warning logs.
 * - Uses class-transformer to create class instances from plain objects prior to validation.
 * - Uses class-validator to perform synchronous validation.
 */

import { Logger, Type } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';

/**
 * A readonly mapping type that reflects the keys of T.
 * Example: Keys<{ foo: string; bar: number }> -> { readonly foo: 'foo'; readonly bar: 'bar' }
 */
type Keys<T> = Readonly<{
  [key in keyof T]: key;
}>;

/**
 * Internal helper that validates an arbitrary config object against the provided Type.
 *
 * Behavior:
 * - Transforms the plain config into an instance of the given class using class-transformer.
 * - Runs synchronous validation with class-validator (does not skip missing properties).
 * - If any validation errors are found, logs warnings for each constraint and returns the original config object unchanged.
 * - If validation succeeds, returns the transformed (and thus typed) config instance.
 *
 * Note: This function intentionally returns Record<string, any> to keep a flexible shape
 * while still enabling typed usage via the provided Type when consumed downstream.
 */
function configValidator(config: object, type: Type): Record<string, any> {
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

/**
 * Produces a reusable validator function bound to the provided class Type.
 *
 * Example:
 *   class AppConfig { @IsString() NODE_ENV!: string; }
 *   const validateAppConfig = validatorFactory(AppConfig);
 *   const safeConfig = validateAppConfig(process.env);
 *
 * @param type The class constructor decorated with class-validator rules.
 * @returns A function that validates a config object and returns either the validated instance
 *          (when valid) or the original input (when invalid), logging warnings on violations.
 */
export function validatorFactory(
  type: Type,
): (config: Record<string, any>) => Record<string, any> {
  return (config) => configValidator(config, type);
}

/**
 * Extracts a read-only map of the property names defined on a class-validator-decorated class.
 *
 * This is useful for:
 * - Enumerating the expected environment/configuration keys.
 * - Building whitelists or generating documentation based on validation metadata.
 *
 * Example:
 *   class AppConfig { @IsString() NODE_ENV!: string; @IsInt() PORT!: number; }
 *   const keys = mapEnvironmentKeys<AppConfig>(AppConfig);
 *   // keys -> { NODE_ENV: 'NODE_ENV', PORT: 'PORT' }
 *
 * @param type The class constructor decorated with class-validator rules.
 * @returns A frozen object where each property name maps to itself.
 */
export function mapEnvironmentKeys<T>(type: Type<T>): Keys<T> {
  const metadataStorage = getMetadataStorage();

  const targetMetadata = metadataStorage.getTargetValidationMetadatas(
    type,
    null,
    false,
    false,
  );

  const entries = targetMetadata.map(({ propertyName }) => [
    propertyName,
    propertyName,
  ]);

  return Object.freeze(Object.fromEntries(entries));
}
