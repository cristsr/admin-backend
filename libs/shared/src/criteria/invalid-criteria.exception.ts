import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions } from '../exceptions/base.exception';
import { DomainException } from '../exceptions/domain.exception';

/**
 * A criteria could not be built: an unknown field, an operator the field does
 * not accept, or a value that does not fit the operator. Always caused by the
 * caller, never by the stored data, so it maps to 400 rather than 500.
 */
export class InvalidCriteriaException extends DomainException {
  readonly code: string = 'INVALID_CRITERIA';
  readonly status: number = HttpStatus.BAD_REQUEST;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
