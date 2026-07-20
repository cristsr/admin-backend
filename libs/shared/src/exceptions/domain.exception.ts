import { ObjectLiteral } from '../types';
import { BaseException } from './base.exception';

export abstract class DomainException extends BaseException {
  /** HTTP status the global filter maps this failure to. */
  abstract readonly status: number;

  format(): ObjectLiteral {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}
