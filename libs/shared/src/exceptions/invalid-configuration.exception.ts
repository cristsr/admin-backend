import { ObjectLiteral } from '../types';
import { BaseExceptionOptions } from './base-exception-options.type';
import { BaseException } from './base.exception';

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
