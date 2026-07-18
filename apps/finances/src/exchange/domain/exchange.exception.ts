import { HttpStatus } from '@nestjs/common';
import { BaseExceptionOptions, DomainException } from '@shared';

/**
 * No hay ninguna tasa histórica disponible para convertir entre las dos monedas
 * en la fecha pedida (ni siquiera una anterior por carry-forward). Maps to 422.
 */
export class ExchangeRateUnavailableException extends DomainException {
  readonly code: string = 'EXCHANGE_RATE_UNAVAILABLE';
  readonly status: number = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
