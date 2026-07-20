import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions } from '../exceptions/base-exception-options.type';
import { DomainException } from '../exceptions/domain.exception';

export class InvalidCriteriaException extends DomainException {
  readonly code: string = 'INVALID_CRITERIA';
  readonly status: number = HttpStatus.BAD_REQUEST;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
