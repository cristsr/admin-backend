import {
  DomainConflictException,
  DomainNotFoundException,
  DomainUnprocessableException,
} from '@shared';

export class AccountNotFoundException extends DomainNotFoundException {}

export class AccountHasMovementsException extends DomainConflictException {}

export class InsufficientBalanceException extends DomainUnprocessableException {}
