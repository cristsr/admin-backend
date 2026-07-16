import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions } from './base.exception';
import { DomainException } from './domain.exception';

/**
 * A business rule refuses the operation because of the current state
 * (e.g. deleting an account that still has movements). Maps to 409.
 */
export class DomainConflictException extends DomainException {
  readonly code: string = 'CONFLICT';
  readonly status: number = HttpStatus.CONFLICT;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
