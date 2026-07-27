import { ProjectionCheckpointRepository } from '@cqrs/application/projection/projection-checkpoint.repository';

/** In-memory checkpoint store for testing async catch-up and rebuild. */
export class InMemoryProjectionCheckpointRepository extends ProjectionCheckpointRepository {
  private readonly positions = new Map<string, bigint>();

  async lastPosition(projectionName: string): Promise<bigint> {
    return this.positions.get(projectionName) ?? 0n;
  }

  async advance(projectionName: string, position: bigint): Promise<void> {
    this.positions.set(projectionName, position);
  }
}
