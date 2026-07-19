import {
  DomainConflictException,
  DomainNotFoundException,
  DomainUnprocessableException,
} from '@shared';

/** Transferring to the same account would create two legs that cancel out. */
export class SameAccountTransferException extends DomainConflictException {}

/**
 * The two accounts hold different currencies, so the amount has no single
 * meaning until conversion exists.
 */
export class TransferCurrencyMismatchException extends DomainConflictException {}

/**
 * No transfer exists for the given transferGroup (or it belongs to another
 * user). Maps to 404.
 */
export class TransferNotFoundException extends DomainNotFoundException {}

/**
 * The transfer was already reversed: a compensating pair already exists for
 * it. Maps to 409.
 */
export class TransferAlreadyReversedException extends DomainConflictException {}

/**
 * AC-1 (sm-0003) — the source account has insufficient balance for the transfer
 * and does not allow a negative balance. Maps to 422.
 */
export class InsufficientBalanceException extends DomainUnprocessableException {}
