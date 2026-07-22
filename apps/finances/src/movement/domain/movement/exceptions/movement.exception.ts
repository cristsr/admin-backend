import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions, DomainException, DomainNotFoundException } from '@shared';

export class MovementNotFoundException extends DomainNotFoundException {}

export class MovementNotEditableException extends DomainException {
  readonly code: string = 'MOVEMENT_NOT_EDITABLE';
  readonly status: number = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
