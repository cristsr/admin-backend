import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { DuplicateExternalRefException } from '@cqrs/domain/exceptions/event-store.exception';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { Nullable } from '@shared';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';

/**
 * Enforces command idempotency by `external_ref` (INV-10). Before running the
 * handler it looks up the anchor event; if one exists, it replays the original
 * outcome without emitting new events. It also catches the store's duplicate
 * error, closing the race where two identical commands pass the pre-check
 * concurrently (defense-in-depth via the unique index).
 */
export class IdempotencyPolicy extends CommandPolicy {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(_command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    if (!ctx.externalRef) return next();

    const existing = await this.eventStore.findByExternalRef(ctx.userId, ctx.externalRef);

    if (existing) return this.replay(existing);

    try {
      return await next();
    } catch (error) {
      if (error instanceof DuplicateExternalRefException) {
        return this.replay(await this.requireAnchor(ctx));
      }

      throw error;
    }
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
