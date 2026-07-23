import { ProjectionCheckpointRepository } from '@ledger/shared-kernel/application/projection/projection-checkpoint.repository';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { PollingProjectionDispatcher } from './polling-dispatcher';

/** A projection and the read-model tables it owns, for a targeted rebuild. */
export type RebuildTarget = {
  readonly projectionName: string;
  readonly projectors: readonly Projector[];
  readonly tables: readonly string[];
};

/**
 * Rebuild and verification tooling (RNF-5). A rebuild truncates the target's
 * tables, resets its checkpoint and replays the whole stream through the same
 * projector code. Verification reports whether the projection has caught up to
 * the stream head (checkpoint == last global position).
 */
export class ProjectionRebuilder {
  constructor(
    private readonly eventStore: EventStore,
    private readonly readModel: ReadModelStore,
    private readonly checkpoints: ProjectionCheckpointRepository,
  ) {}

  /** Truncates the target's tables and replays the stream; returns events applied. */
  async rebuild(target: RebuildTarget): Promise<number> {
    for (const table of target.tables) {
      await this.readModel.truncate(table);
    }

    await this.checkpoints.advance(target.projectionName, 0n);

    const poller = new PollingProjectionDispatcher(
      target.projectionName,
      this.eventStore,
      target.projectors,
      this.readModel,
      this.checkpoints,
    );

    return poller.catchUp();
  }

  /** True when the projection's checkpoint has reached the stream head (RNF-5). */
  async isCaughtUp(projectionName: string): Promise<boolean> {
    const events = await this.eventStore.readAll(0n, Number.MAX_SAFE_INTEGER);
    const checkpoint = await this.checkpoints.lastPosition(projectionName);

    if (!events.length) return checkpoint === 0n;

    return checkpoint >= events[events.length - 1].globalPosition;
  }
}
