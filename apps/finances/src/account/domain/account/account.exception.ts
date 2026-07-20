import {
  DomainConflictException,
  DomainNotFoundException,
  DomainUnprocessableException,
} from '@shared';

export class AccountNotFoundException extends DomainNotFoundException {}

export class AccountHasMovementsException extends DomainConflictException {}

/**
 * AC-1 (sm-0003) — the account cannot fund the withdrawal and does not allow a
 * negative balance. Maps to 422.
 */
export class InsufficientBalanceException extends DomainUnprocessableException {}
