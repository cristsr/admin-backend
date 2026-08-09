import { DomainConflictException } from '@shared';

/**
 * Optimistic concurrency failed (INV-7): the stream head moved since the caller
 * read it. The command should be retried against the fresh state.
 */
export class ConcurrencyConflictException extends DomainConflictException {
  readonly code: string = 'CONCURRENCY_CONFLICT';
}

/**
 * The command's `external_ref` was already used by this user (INV-10). The
 * command bus short-circuits on this to replay the original outcome rather than
 * emitting duplicate events.
 */
export class DuplicateExternalRefException extends DomainConflictException {
  readonly code: string = 'DUPLICATE_EXTERNAL_REF';
}

/**
 * A command reused an `external_ref` already anchored to different inputs
 * (AC-6). Unlike {@link DuplicateExternalRefException} — the port's defense
 * against a concurrent race on the same inputs — this is the policy's
 * intentional rejection of an accidental reference reuse by an automated
 * client: the original operation is never lost silently.
 */
export class IdempotencyInputMismatchException extends DomainConflictException {
  readonly code: string = 'IDEMPOTENCY_INPUT_MISMATCH';
}
