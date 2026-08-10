import { PersistenceConflictException } from '@cqrs/domain/exceptions/persistence-conflict.exception';
import { TransientPersistenceException } from '@cqrs/domain/exceptions/transient-persistence.exception';
import { AuthContext } from '../auth-context.type';
import { Command } from '../command';
import { CommandNext, CommandPolicy } from '../command-policy';
import { CommandResult } from '../command-result.type';
import { RetryCounter } from './retry-counter';

/** Total attempts including the original execution (AC-5). */
const TOTAL_ATTEMPTS = 3;
/** Exponential base delay; jitter keeps concurrent retries from re-colliding. */
const BASE_DELAY_MS = 10;
const JITTER_MAX_MS = 30;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries a command whose persistence failed transiently — deadlock (`40P01`)
 * or serialization (`40001`), surfaced by the Postgres adapter as
 * {@link TransientPersistenceException} (F-14, AC-5). The command was valid; it
 * only lost a lock race, so the whole chain is re-run (handlers are
 * deterministic given the same starting state).
 *
 * Bounded: 3 attempts total with exponential backoff + jitter. On exhaustion it
 * raises the stable {@link PersistenceConflictException} (409) instead of the
 * raw driver error. It never catches {@link ConcurrencyConflictException}
 * (AC-6: the aggregate moved; the concurrency policy's own retry-once with
 * reload owns that) nor {@link DuplicateExternalRefException} (AC-7: the
 * idempotency policy re-reads the anchor).
 *
 * Each retry increments {@link RetryCounter} keyed by command type (AC-8).
 */
export class RetryPolicy extends CommandPolicy {
  constructor(
    private readonly counter: RetryCounter,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {
    super();
  }

  async handle(command: Command, ctx: AuthContext, next: CommandNext): Promise<CommandResult> {
    for (let attempt = 0; attempt < TOTAL_ATTEMPTS; attempt += 1) {
      try {
        return await next(ctx);
      } catch (error) {
        if (!(error instanceof TransientPersistenceException)) throw error;

        if (attempt === TOTAL_ATTEMPTS - 1) {
          throw new PersistenceConflictException(
            `Transient persistence failure exhausted after ${TOTAL_ATTEMPTS} attempts`,
          );
        }

        this.counter.increment(command.commandType);
        await this.wait(BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * JITTER_MAX_MS));
      }
    }

    throw new PersistenceConflictException(
      `Transient persistence failure exhausted after ${TOTAL_ATTEMPTS} attempts`,
    );
  }
}
