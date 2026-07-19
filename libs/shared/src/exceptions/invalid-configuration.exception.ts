import { ObjectLiteral } from '../types';
import { BaseException, BaseExceptionOptions } from './base.exception';

/**
 * Thrown at startup when the environment does not satisfy its schema.
 * Configuration must fail fast: continuing with unvalidated values silently
 * feeds raw strings to consumers that expect typed ones — the string 'false'
 * is truthy, which is how `synchronize` once ended up enabled.
 */
export class InvalidConfigurationException extends BaseException {
  readonly code = 'INVALID_CONFIGURATION';

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }

  format(): ObjectLiteral {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}
