import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import {
  DuplicateExternalRefException,
  IdempotencyInputMismatchException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { Nullable, canonicalJson, sha256Hex } from '@shared';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';

/**
 * Enforces command idempotency by `external_ref` (INV-10) and, since hu-0024,
 * detects an accidental reuse of the same reference with different inputs
 * (AC-6): before it just replayed; now it compares a canonical hash of the
 * inputs against the one stamped on the anchor and rejects on mismatch,
 * instead of silently losing the new operation.
 */
export class IdempotencyPolicy extends CommandPolicy {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    if (!ctx.externalRef) return next(ctx);

    const inputHash = await this.hashInputs(command, ctx.userId);
    const existing = await this.eventStore.findByExternalRef(ctx.userId, ctx.externalRef);

    if (existing) return this.resolve(existing, inputHash);

    try {
      return await next({ ...ctx, externalRefHash: inputHash });
    } catch (error) {
      if (error instanceof DuplicateExternalRefException) {
        return this.resolve(await this.requireAnchor(ctx), inputHash);
      }

      throw error;
    }
  }

  /** AC-5: the command's own fields plus `userId`, excluding transport metadata. */
  private async hashInputs(command: Command, userId: string): Promise<string> {
    const canonical = await canonicalJson({ userId, command });
    return sha256Hex(canonical);
  }

  /** AC-6: covers both the pre-check and the race-condition path with the same rule. */
  private resolve(anchor: StoredEvent, inputHash: string): CommandResult {
    if (anchor.externalRefHash !== inputHash) {
      throw new IdempotencyInputMismatchException(
        `external_ref "${anchor.externalRef}" was already used with different inputs`,
      );
    }

    return this.replay(anchor);
  }

  private async requireAnchor(ctx: AuthContext): Promise<StoredEvent> {
    const anchor: Nullable<StoredEvent> = await this.eventStore.findByExternalRef(
      ctx.userId,
      ctx.externalRef as string,
    );

    if (!anchor) {
      throw new DuplicateExternalRefException(
        `external_ref "${ctx.externalRef}" reported duplicate but no anchor was found`,
      );
    }

    return anchor;
  }

  private replay(anchor: StoredEvent): CommandResult {
    return {
      aggregateId: anchor.aggregateId,
      streamPosition: anchor.globalPosition,
      idempotentReplay: true,
    };
  }
}
