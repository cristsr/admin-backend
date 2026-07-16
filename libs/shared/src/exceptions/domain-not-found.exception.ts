import { BaseExceptionOptions } from './base.exception';
import { DomainException } from './domain.exception';

export class DomainNotFoundException extends DomainException {
  readonly code: string = 'NOT_FOUND';

  constructor(message: string, options?: BaseExceptionOptions) {
    super(message, options);
  }
}
