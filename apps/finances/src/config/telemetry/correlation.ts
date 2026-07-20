import { randomUUID } from 'node:crypto';
import { SpanStatusCode, isSpanContextValid, trace } from '@opentelemetry/api';
import { Nullable } from '@shared';

const TRACER_NAME = 'finances';

/**
 * Trace id of the active span, read from AsyncLocalStorage context; null when
 * telemetry is off (the no-op span's all-zero id is rejected).
 */
export function currentTraceId(): Nullable<string> {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (!spanContext || !isSpanContextValid(spanContext)) return null;

  return spanContext.traceId;
}

/** The trace id, or a fresh uuid when telemetry is disabled. */
export function correlationId(): string {
  return currentTraceId() ?? randomUUID();
}

/**
 * Runs background work inside its own span — scheduled jobs have no incoming
 * request to inherit a trace from. Failures are recorded, then rethrown.
 */
export async function withSpan<T>(
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  return trace.getTracer(TRACER_NAME).startActiveSpan(name, async (span) => {
    try {
      return await work();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
