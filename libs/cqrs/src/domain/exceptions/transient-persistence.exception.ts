import { DomainException } from '@shared';

/**
 * A transient PostgreSQL persistence failure (deadlock `40P01` or serialization
 * `40001`). Raised by the Postgres adapter so the retry policy can act on a
 * typed domain exception (Artículo 1). Never surfaces through the API: it is
 * either retried or converted into {@link PersistenceConflictException}.
 */
export class TransientPersistenceException extends DomainException {
  readonly code: string = 'TRANSIENT_PERSISTENCE';
  readonly status: number = 503;

  constructor(message: string) {
    super(message);
  }
}
