import { EventStore } from '@cqrs/domain/ports/event-store';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';

/**
 * Executes a command inside a transaction and always rolls it back (F-12,
 * AC-2). The preview cannot diverge from a real run because it is the real
 * run: validations, aggregate invariants, event generation and the synchronous
 * projections all happen inside the transaction, then only the commit is
 * skipped. The produced {@link CommandResult} is returned unchanged (AC-4).
 *
 * No reactor (§3.2) ever fires for a preview: reactors consume the persisted
 * stream, and a rollback persists nothing (AC-3). Event ids are UUIDs — there
 * is no sequence to burn; `global_position` gaps are harmless for catch-up.
 */
export class DryRunPolicy extends CommandPolicy {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    if (!ctx.dryRun) return next(ctx);

    return this.eventStore.withTransaction(() => next(ctx), { rollback: true });
  }
}
