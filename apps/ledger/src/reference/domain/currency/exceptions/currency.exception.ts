import { DomainConflictException, DomainUnprocessableException } from '@shared';

/**
 * A currency was registered with a precision outside ISO-4217's range (0 to 4).
 */
export class InvalidMinorUnitsException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_MINOR_UNITS';
}

/**
 * A currency already registered was re-registered with a different precision.
 * Allowing it would reinterpret every amount recorded in that currency — `100`
 * would go from meaning 100 to meaning 1.00 (design principle #5).
 */
export class CurrencyPrecisionConflictException extends DomainConflictException {
  readonly code: string = 'CURRENCY_PRECISION_CONFLICT';
}
