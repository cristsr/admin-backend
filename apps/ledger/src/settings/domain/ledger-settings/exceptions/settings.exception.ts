import { DomainUnprocessableException } from '@shared';

/** Exception raised when an invalid currency code is provided. */
export class InvalidCurrencyCodeException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_CURRENCY_CODE';

  constructor(code: string) {
    super(`Invalid currency code: ${code}`);
  }
}

/** Exception raised when an invalid IANA timezone is provided. */
export class InvalidTimeZoneException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_TIME_ZONE';

  constructor(timezone: string) {
    super(`Invalid IANA timezone: ${timezone}`);
  }
}
