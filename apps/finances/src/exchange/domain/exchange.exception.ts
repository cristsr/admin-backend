import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions, DomainException } from '@shared';

/**
 * There is no historical rate available to convert between the two currencies
 * on the requested date (not even an earlier one via carry-forward). Maps to
 * 422.
 */
export class ExchangeRateUnavailableException extends DomainException {
  readonly code: string = 'EXCHANGE_RATE_UNAVAILABLE';
  readonly status: number = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
