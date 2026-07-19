import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions } from './base.exception';
import { DomainException } from './domain.exception';

/**
 * The request is well-formed but a business rule refuses to process it
 * (e.g. a transfer that would overdraw an account, or an idempotency key
 * replayed with a different body). Maps to 422.
 */
export class DomainUnprocessableException extends DomainException {
  readonly code: string = 'UNPROCESSABLE_ENTITY';
  readonly status: number = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
