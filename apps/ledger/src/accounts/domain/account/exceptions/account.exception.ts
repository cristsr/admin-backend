import { DomainConflictException, DomainUnprocessableException } from '@shared';

/**
 * A system account (`Equity:OpeningBalances`, `Equity:Adjustments`) cannot be
 * renamed or closed (INV-13).
 */
export class SystemAccountProtectedException extends DomainConflictException {
  readonly code: string = 'SYSTEM_ACCOUNT_PROTECTED';
}

/** A real account (ASSETS/LIABILITIES) must declare exactly one currency. */
export class RealAccountCurrencyException extends DomainUnprocessableException {
  readonly code: string = 'REAL_ACCOUNT_SINGLE_CURRENCY';
}

/** The account is not open on the posting date (INV-3, partial). */
export class AccountClosedException extends DomainUnprocessableException {
  readonly code: string = 'ACCOUNT_CLOSED';
}

/** The account is already closed and cannot be closed again. */
export class AccountAlreadyClosedException extends DomainConflictException {
  readonly code: string = 'ACCOUNT_ALREADY_CLOSED';
}

/** A close date that precedes the open date is invalid. */
export class InvalidCloseDateException extends DomainUnprocessableException {
  readonly code: string = 'INVALID_CLOSE_DATE';
}

/** The posting currency is not among the account's allowed currencies (INV-4). */
export class CurrencyNotAllowedException extends DomainUnprocessableException {
  readonly code: string = 'CURRENCY_NOT_ALLOWED';
}

/** An account with the same hierarchical name already exists for the user. */
export class NameCollisionException extends DomainConflictException {
  readonly code: string = 'NAME_COLLISION';
}
