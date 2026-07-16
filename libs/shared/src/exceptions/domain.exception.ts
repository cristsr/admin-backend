import { BaseException } from './base.exception';
import { ObjectLiteral } from '../types';

export abstract class DomainException extends BaseException {
  /** HTTP status this domain failure maps to. The global filter reads it so
   * a domain exception no longer falls through to a generic 500. */
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
