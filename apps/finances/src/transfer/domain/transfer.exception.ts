import { DomainConflictException } from '@shared';

/** Transferring to the same account would create two legs that cancel out. */
export class SameAccountTransferException extends DomainConflictException {}

/** The two accounts hold different currencies, so the amount has no single
 * meaning until conversion exists. */
export class TransferCurrencyMismatchException extends DomainConflictException {}
