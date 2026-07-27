import { ConcurrencyConflictException } from '@cqrs/domain/exceptions/event-store.exception';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';

/** How many times a conflicted command is retried before surfacing the error. */
const MAX_RETRIES = 1;

/**
 * Bounds optimistic-concurrency conflicts (INV-7). A conflict means nothing was
 * persisted, so re-running the handler — which reloads the aggregate against the
 * fresh head — is safe. After the retry budget the stable
 * `CONCURRENCY_CONFLICT` error propagates.
 */
export class OptimisticConcurrencyPolicy extends CommandPolicy {
  async handle(_command: Command, _ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await next();
      } catch (error) {
        if (error instanceof ConcurrencyConflictException && attempt < MAX_RETRIES) continue;

        throw error;
      }
    }
  }
}
