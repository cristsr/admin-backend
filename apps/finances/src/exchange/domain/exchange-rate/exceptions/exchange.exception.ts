import { DomainUnprocessableException } from '@shared';

/** Raised when no rate can be resolved for a currency pair at a date. */
export class ExchangeRateUnavailableException extends DomainUnprocessableException {
  readonly code: string = 'EXCHANGE_RATE_UNAVAILABLE';
}
