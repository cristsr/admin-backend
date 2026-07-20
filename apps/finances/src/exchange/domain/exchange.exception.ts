import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions, DomainException } from '@shared';

export class ExchangeRateUnavailableException extends DomainException {
  readonly code: string = 'EXCHANGE_RATE_UNAVAILABLE';
  readonly status: number = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
