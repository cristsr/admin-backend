import { DomainConflictException, DomainNotFoundException } from '@shared';

export class CategoryNotFoundException extends DomainNotFoundException {}

/**
 * AC-4 (sm-0003) — a system-managed category (e.g. "Sin categorizar") cannot be
 * deleted through the API. Maps to 409.
 */
export class CategoryIsSystemException extends DomainConflictException {}
