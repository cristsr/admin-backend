import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { ReadModelStore } from './read-model-store';

/**
 * A projector maps events to a read model (core code, §3.7). The same instance
 * runs synchronously (in the command transaction) or asynchronously (poller); it
 * never knows which. It declares the event types it consumes so the dispatcher
 * can route efficiently.
 */
export abstract class Projector {
  abstract readonly name: string;

  abstract readonly consumes: readonly string[];

  abstract project(event: StoredEvent, store: ReadModelStore): Promise<void>;

  /** True when this projector reacts to the event's type. */
  handles(eventType: string): boolean {
    return this.consumes.includes(eventType);
  }
}
