import { ObjectLiteral } from '../types';

export interface BaseExceptionOptions {
  cause?: Error;
  context?: ObjectLiteral;
}

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
