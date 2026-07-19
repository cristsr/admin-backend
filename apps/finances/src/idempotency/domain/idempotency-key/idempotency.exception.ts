import { DomainConflictException, DomainUnprocessableException } from '@shared';

/**
 * AC-3 (sm-0003) — the idempotency key was already used with a different request
 * body. Maps to 422.
 */
export class IdempotencyConflictException extends DomainUnprocessableException {}

/**
 * AC-3 (sm-0003) — a request with the same idempotency key is still in progress
 * (reserved but not yet completed). Maps to 409.
 */
export class IdempotencyInProgressException extends DomainConflictException {}
