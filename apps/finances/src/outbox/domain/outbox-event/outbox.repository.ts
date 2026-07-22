import { ObjectLiteral } from '@shared';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

/**
 * Port for the transactional outbox. `EntityManager` is exposed on purpose so
 * events share the caller's unit of work.
 */
export abstract class OutboxRepository {
  abstract saveWithinTransaction(
    manager: EntityManager,
    event: { eventType: string; payload: ObjectLiteral },
  ): Promise<void>;

  /** Claims deliverable events, skipping rows locked by a concurrent relay tick. */
  abstract claimPendingBatch(limit: number): Promise<OutboxEvent[]>;

  abstract markDelivered(id: number): Promise<void>;

  abstract markFailed(id: number, error: string, backoffSeconds: number): Promise<void>;
}
