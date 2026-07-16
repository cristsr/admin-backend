import { DomainConflictException, DomainNotFoundException } from '@shared';

export class AccountNotFoundException extends DomainNotFoundException {}

export class AccountHasMovementsException extends DomainConflictException {}
