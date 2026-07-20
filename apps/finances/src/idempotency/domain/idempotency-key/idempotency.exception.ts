import { DomainConflictException, DomainUnprocessableException } from '@shared';

export class IdempotencyConflictException extends DomainUnprocessableException {}

export class IdempotencyInProgressException extends DomainConflictException {}
