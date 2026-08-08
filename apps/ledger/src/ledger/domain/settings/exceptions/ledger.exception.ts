import { DomainConflictException } from '@shared';

/** A ledger is initialized only once per user. */
export class LedgerAlreadyInitializedException extends DomainConflictException {
  readonly code: string = 'LEDGER_ALREADY_INITIALIZED';
}
