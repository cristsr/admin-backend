import { DomainConflictException, DomainNotFoundException } from '@shared';

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
