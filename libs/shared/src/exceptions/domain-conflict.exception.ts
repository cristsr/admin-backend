import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions } from './base-exception-options.type';
import { DomainException } from './domain.exception';

export class DomainConflictException extends DomainException {
  readonly code: string = 'CONFLICT';
  readonly status: number = HttpStatus.CONFLICT;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
