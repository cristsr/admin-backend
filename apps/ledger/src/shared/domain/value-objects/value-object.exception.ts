import { DomainUnprocessableException } from '@shared';

/** A hierarchical account name is malformed (bad root type, empty segment, ...). */
export class InvalidAccountNameException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_ACCOUNT_NAME';
}

/**
 * A rename would change a name's root type. The root type is immutable
 * (INV-14), so re-rooting under a different top-level type is rejected.
 */
export class RootTypeImmutableException extends DomainUnprocessableException {
  readonly code: string = 'ROOT_TYPE_IMMUTABLE';
}

/** A ledger date literal is not a valid `YYYY-MM-DD` calendar date. */
export class InvalidLedgerDateException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_LEDGER_DATE';
}

/** A currency code is blank or otherwise not a usable identifier. */
export class InvalidCurrencyCodeException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_CURRENCY_CODE';
}

/** No currency is registered for the requested code in the catalog. */
export class UnknownCurrencyException extends DomainUnprocessableException {
  readonly code: string = 'UNKNOWN_CURRENCY';
}

/** The payee (merchant/counterparty) exceeds its length bound. */
export class InvalidPayeeException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_PAYEE';
}
