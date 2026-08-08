import { DomainUnprocessableException } from '@shared';

/** A command arrived without a valid authenticated context. */
export class MissingAuthContextException extends DomainUnprocessableException {
  readonly code: string = 'MISSING_AUTH_CONTEXT';
}
