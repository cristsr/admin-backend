import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions } from './base-exception-options.type';
import { DomainException } from './domain.exception';

export class DomainUnprocessableException extends DomainException {
  readonly code: string = 'UNPROCESSABLE_ENTITY';
  readonly status: number = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
