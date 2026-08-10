import { DomainConflictException } from '@shared';

/**
 * The stable 409 contract of the retry policy (AC-5): the transient-persistence
 * retry budget was exhausted. Replaces the raw QueryFailedError that would
 * otherwise surface as a 500 without a code.
 */
export class PersistenceConflictException extends DomainConflictException {
  readonly code: string = 'PERSISTENCE_CONFLICT';
}
