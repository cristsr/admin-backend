/**
 * Tracks how far each named projection has consumed the global stream, enabling
 * async catch-up and rebuild. The gap between the stream head and a
 * checkpoint is the projection lag exposed as a metric.
 */
export abstract class ProjectionCheckpointRepository {
  /** Last global position applied by the projection; 0 when never run. */
  abstract lastPosition(projectionName: string): Promise<bigint>;

  abstract advance(projectionName: string, position: bigint): Promise<void>;
}
