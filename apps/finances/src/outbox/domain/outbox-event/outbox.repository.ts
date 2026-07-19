import { ObjectLiteral } from '@shared';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

/**
 * Port for the transactional outbox (AC-2, sm-0003). Writers persist events
 * within their own transaction; the relay claims, delivers and settles them.
 *
 * `EntityManager` leaks into the port on purpose: a transactional outbox has to
 * share the caller's unit of work, and reifying a framework-neutral transaction
 * abstraction adds no value in this single-ORM codebase.
 */
export abstract class OutboxRepository {
  /** Persist a pending event within the caller's transaction. */
  abstract saveWithinTransaction(
    manager: EntityManager,
    event: { eventType: string; payload: ObjectLiteral },
  ): Promise<void>;

  /**
   * Claim a batch of deliverable events (PENDING/FAILED, available now),
   * skipping rows locked by a concurrent relay tick.
   */
  abstract claimPendingBatch(limit: number): Promise<OutboxEvent[]>;

  abstract markDelivered(id: number): Promise<void>;

  /** Increment attempts, store the error and push availableAt by the backoff. */
  abstract markFailed(
    id: number,
    error: string,
    backoffSeconds: number,
  ): Promise<void>;
}
