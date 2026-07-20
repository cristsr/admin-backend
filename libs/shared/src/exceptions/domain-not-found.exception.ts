import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions } from './base-exception-options.type';
import { DomainException } from './domain.exception';

export class DomainNotFoundException extends DomainException {
  readonly code: string = 'NOT_FOUND';
  readonly status: number = HttpStatus.NOT_FOUND;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
