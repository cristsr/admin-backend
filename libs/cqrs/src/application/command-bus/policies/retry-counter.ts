/**
 * Minimum metric sink for the retry policy (AC-8): a counter keyed by command
 * type. Lives in the application layer as a port so the core never knows
 * OpenTelemetry (Artículo 1, RNF-12). The real adapter is the OTel counter;
 * tests and compositions that do not observe use the no-op.
 */
export abstract class RetryCounter {
  abstract increment(commandType: string): void;
}

/** Discards increments; used by compositions that do not observe (tests). */
export class NoopRetryCounter extends RetryCounter {
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberate no-op sink
  increment(_commandType: string): void {}
}
