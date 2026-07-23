import { ProjectionCheckpointRepository } from '@ledger/shared-kernel/application/projection/projection-checkpoint.repository';
import { ProjectionDispatcher } from '@ledger/shared-kernel/application/projection/projection-dispatcher';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';

/** Default batch size for one catch-up tick. */
const DEFAULT_BATCH = 500;

/**
 * Asynchronous dispatcher: reads the global stream from a persisted checkpoint
 * and applies the same projectors as the synchronous path (§3.8). Upserts are
 * idempotent by key, so replays from the checkpoint never double-count. The gap
 * to the stream head is the projection lag (RNF-12).
 */
export class PollingProjectionDispatcher extends ProjectionDispatcher {
  constructor(
    private readonly projectionName: string,
    private readonly eventStore: EventStore,
    private readonly projectors: readonly Projector[],
    private readonly store: ReadModelStore,
    private readonly checkpoints: ProjectionCheckpointRepository,
    private readonly batchSize: number = DEFAULT_BATCH,
  ) {
    super();
  }

  /** Applies an explicit batch (used when the caller already has the events). */
  async dispatch(events: readonly StoredEvent[]): Promise<void> {
    await this.applyAll(events);

    const last = events[events.length - 1];

    if (last) await this.checkpoints.advance(this.projectionName, last.globalPosition);
  }

  /** Pulls the next batch from the checkpoint and applies it; returns the count. */
  async pollOnce(): Promise<number> {
    const from = await this.checkpoints.lastPosition(this.projectionName);
    const events = await this.eventStore.readAll(from, this.batchSize);

    if (!events.length) return 0;

    await this.dispatch(events);

    return events.length;
  }

  /** Drains the stream until caught up; returns the total applied. */
  async catchUp(): Promise<number> {
    let total = 0;

    for (let batch = await this.pollOnce(); batch > 0; batch = await this.pollOnce()) {
      total += batch;
    }

    return total;
  }

  private async applyAll(events: readonly StoredEvent[]): Promise<void> {
    for (const event of events) {
      for (const projector of this.projectors) {
        if (!projector.handles(event.eventType)) continue;

        await projector.project(event, this.store);
      }
    }
  }
}
