import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';

/**
 * Runs the configured projectors inline over freshly appended events, so
 * critical views are updated in the command's unit of work (read-your-writes).
 * A projector failure propagates, aborting the command.
 */
export class SynchronousProjectionDispatcher extends ProjectionDispatcher {
  constructor(
    private readonly projectors: readonly Projector[],
    private readonly store: ReadModelStore,
  ) {
    super();
  }

  async dispatch(events: readonly StoredEvent[]): Promise<void> {
    for (const event of events) {
      for (const projector of this.projectors) {
        if (!projector.handles(event.eventType)) continue;

        await projector.project(event, this.store);
      }
    }
  }
}
