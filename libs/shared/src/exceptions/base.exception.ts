import { ObjectLiteral } from '../types';
import { BaseExceptionOptions } from './base-exception-options.type';

export abstract class BaseException extends Error {
  abstract readonly code: string;
  readonly name: string;
  readonly context?: ObjectLiteral;
  readonly cause?: Error;

  protected constructor(message: string, options?: BaseExceptionOptions) {
    super(message);
    this.name = this.constructor.name;
    this.context = options?.context;
    this.cause = options?.cause;
  }

  abstract format(): ObjectLiteral;
}
