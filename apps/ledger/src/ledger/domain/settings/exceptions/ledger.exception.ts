import {
  DomainConflictException,
  DomainNotFoundException,
  DomainUnprocessableException,
} from '@shared';

/** A ledger is initialized only once per user (RF-2). */
export class LedgerAlreadyInitializedException extends DomainConflictException {
  readonly code: string = 'LEDGER_ALREADY_INITIALIZED';
}

/**
 * An operation needs a ledger that was never initialized. Reuses the stable code
 * already declared in `shared/domain/errors/ledger-error-code.ts` — the same one
 * `reconciliation` reports for this condition (RF-14).
 */
export class LedgerNotInitializedException extends DomainUnprocessableException {
  readonly code: string = 'LEDGER_NOT_INITIALIZED';
}

/** An operation referenced a ledger or account that does not exist. */
export class AccountNotFoundException extends DomainNotFoundException {
  readonly code: string = 'ACCOUNT_NOT_FOUND';
}
