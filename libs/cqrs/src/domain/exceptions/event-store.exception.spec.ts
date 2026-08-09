import { DomainConflictException } from '@shared';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
  IdempotencyInputMismatchException,
} from './event-store.exception';

describe('IdempotencyInputMismatchException', () => {
  it('extends DomainConflictException with a stable code', () => {
    const error = new IdempotencyInputMismatchException('mismatch');

    expect(error).toBeInstanceOf(DomainConflictException);
    expect(error.code).toBe('IDEMPOTENCY_INPUT_MISMATCH');
  });
});

describe('ConcurrencyConflictException', () => {
  it('extends DomainConflictException with a stable code', () => {
    expect(new ConcurrencyConflictException('x').code).toBe('CONCURRENCY_CONFLICT');
  });
});

describe('DuplicateExternalRefException', () => {
  it('extends DomainConflictException with a stable code', () => {
    expect(new DuplicateExternalRefException('x').code).toBe('DUPLICATE_EXTERNAL_REF');
  });
});
