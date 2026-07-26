import { ProjectionCheckpointRepository } from '@ledger/shared-kernel/application/projection/projection-checkpoint.repository';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { ProjectionRegistry } from '@ledger/shared-kernel/application/tooling/projection-registry';
import { RebuildReport } from '@ledger/shared-kernel/application/tooling/rebuild-report.type';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { PollingProjectionDispatcher } from './polling-dispatcher';

export type RebuildTarget = {
  readonly projectionName: string;
  readonly projectors: readonly Projector[];
  readonly tables: readonly string[];
};

export class ProjectionRebuilder {
  constructor(
    private readonly eventStore: EventStore,
    private readonly readModel: ReadModelStore,
    private readonly checkpoints: ProjectionCheckpointRepository,
    private readonly registry: ProjectionRegistry,
  ) {}

  async rebuild(projectionName: string): Promise<number> {
    const entry = this.registry.get(projectionName);

    return this.rebuildTarget({
      projectionName,
      projectors: entry.projectors,
      tables: entry.tables,
    });
  }

  async rebuildAll(): Promise<RebuildReport[]> {
    const results: RebuildReport[] = [];

    for (const name of this.registry.names()) {
      try {
        const applied = await this.rebuild(name);
        results.push({ projectionName: name, success: true, eventsApplied: applied });
      } catch (error) {
        results.push({
          projectionName: name,
          success: false,
          eventsApplied: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  private async rebuildTarget(target: RebuildTarget): Promise<number> {
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

  async isCaughtUp(projectionName: string): Promise<boolean> {
    const events = await this.eventStore.readAll(0n, Number.MAX_SAFE_INTEGER);
    const checkpoint = await this.checkpoints.lastPosition(projectionName);

    if (!events.length) return checkpoint === 0n;

    return checkpoint >= events[events.length - 1].globalPosition;
  }
}
