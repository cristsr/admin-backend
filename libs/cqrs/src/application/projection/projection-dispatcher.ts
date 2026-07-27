import { StoredEvent } from '@cqrs/domain/event/stored-event.type';

/**
 * Drives projectors over a batch of events. The mode (synchronous in the
 * command transaction, or asynchronous from a checkpoint) is adapter
 * configuration per projection, never a branch in the core (§3.8).
 */
export abstract class ProjectionDispatcher {
  abstract dispatch(events: readonly StoredEvent[]): Promise<void>;
}
