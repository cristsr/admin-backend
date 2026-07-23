import { Type } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InvalidConfigurationException } from '../exceptions';

/**
 * Transforms and validates the config against the class. Any error is fatal:
 * the app must not boot on a config it could not validate.
 */
export function configValidator(
  config: object,
  type: Type,
): Record<string, any> {
  const validatedConfig = plainToClass(type, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length) {
    const failures = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    throw new InvalidConfigurationException(
      `Invalid ${type.name}:\n  - ${failures.join('\n  - ')}`,
      {
        context: { invalid: errors.map((error) => error.property) },
      },
    );
  }

  return validatedConfig;
}
