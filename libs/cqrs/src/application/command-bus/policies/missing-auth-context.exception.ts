import { DomainUnprocessableException } from '@shared';

/** A command arrived without a valid authenticated context (RF-26). */
export class MissingAuthContextException extends DomainUnprocessableException {
  readonly code: string = 'MISSING_AUTH_CONTEXT';
}
