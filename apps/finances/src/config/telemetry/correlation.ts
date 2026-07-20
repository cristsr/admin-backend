import { randomUUID } from 'node:crypto';
import { SpanStatusCode, isSpanContextValid, trace } from '@opentelemetry/api';
import { Nullable } from '@shared';

/** Tracer name reported for spans this service opens by hand. */
const TRACER_NAME = 'finances';

/**
 * The id that ties together everything done while serving one request or one
 * cron run.
 *
 * It comes from the active OpenTelemetry span, whose context rides on
 * AsyncLocalStorage — which is why it can be read anywhere in the call chain
 * without being passed down as an argument. With telemetry switched off the
 * API hands back a non-recording span whose ids are all zeroes, so that case
 * is rejected explicitly rather than logged as a fake trace.
 */
export function currentTraceId(): Nullable<string> {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (!spanContext || !isSpanContextValid(spanContext)) return null;

  return spanContext.traceId;
}

/**
 * The same id, guaranteed to exist. Falls back to a fresh uuid so a flow stays
 * traceable in the logs even when telemetry is disabled — which is the normal
 * state locally.
 */
export function correlationId(): string {
  return currentTraceId() ?? randomUUID();
}

/**
 * Runs background work inside its own span. Scheduled jobs have no incoming
 * request to inherit a trace from, so each run starts one: that is what makes
 * the run show up as a trace, and what gives everything it calls a shared id
 * without threading one through by hand.
 *
 * The span records a failure before rethrowing — the error still belongs to
 * the caller, the span only reports it.
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
