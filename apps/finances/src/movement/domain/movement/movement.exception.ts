import { HttpStatus } from '@nestjs/common';
import {
  BaseExceptionOptions,
  DomainException,
  DomainNotFoundException,
} from '@shared';

export class MovementNotFoundException extends DomainNotFoundException {}

/**
 * The edit is refused because it would break an invariant: changing the type,
 * touching a transfer leg, or editing an ingestion-owned field on a WEBHOOK
 * movement. Maps to 422.
 */
export class MovementNotEditableException extends DomainException {
  readonly code: string = 'MOVEMENT_NOT_EDITABLE';
  readonly status: number = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
