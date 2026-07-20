import { DomainConflictException, DomainNotFoundException } from '@shared';

export class SameAccountTransferException extends DomainConflictException {}

export class TransferCurrencyMismatchException extends DomainConflictException {}

export class TransferNotFoundException extends DomainNotFoundException {}

export class TransferAlreadyReversedException extends DomainConflictException {}
