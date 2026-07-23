/**
 * Exception raised when an invalid currency code is provided.
 */
export class InvalidCurrencyCodeException extends Error {
  constructor(code: string) {
    super(`Invalid currency code: ${code}`);
    this.name = 'InvalidCurrencyCodeException';
  }
}

/**
 * Exception raised when an invalid IANA timezone is provided.
 */
export class InvalidTimeZoneException extends Error {
  constructor(timezone: string) {
    super(`Invalid IANA timezone: ${timezone}`);
    this.name = 'InvalidTimeZoneException';
  }
}
