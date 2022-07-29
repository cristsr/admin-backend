import { Logger, Type } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

export function configValidator(config: object, type: Type) {
  const logger = new Logger(configValidator.name);

  const validatedConfig = plainToClass(type, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    errors
      .map((error) => error.constraints)
      .map((constraints) => Object.values(constraints))
      .forEach(([v]) => logger.error(v));

    // throw new TypeError('Invalid environment configuration');
    return config;
  }

  return validatedConfig;
}

export function mapEnvironmentKeys<T>(type: Type<T>): Readonly<{
  [key in keyof T]: string;
}> {
  const keys = Object.keys(new type()) as (keyof T)[];

  const entries: (keyof T)[][] = keys.map((key) => [key, key]);

  return Object.freeze(Object.fromEntries(entries));
}
