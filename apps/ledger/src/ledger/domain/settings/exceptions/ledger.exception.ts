import { DomainConflictException, DomainNotFoundException } from '@shared';

/** A ledger is initialized only once per user (RF-2). */
export class LedgerAlreadyInitializedException extends DomainConflictException {
  readonly code: string = 'LEDGER_ALREADY_INITIALIZED';
}

/** An operation referenced a ledger or account that does not exist. */
export class AccountNotFoundException extends DomainNotFoundException {
  readonly code: string = 'ACCOUNT_NOT_FOUND';
}
