import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { correlationId, currentTraceId } from './correlation';

describe('correlation ids', () => {
  describe('with telemetry disabled', () => {
    it('reports no trace id', () => {
      expect(currentTraceId()).toBeNull();
    });

    it('still yields a usable correlation id', () => {
      const first = correlationId();

      expect(first).toHaveLength(36);
      expect(correlationId()).not.toBe(first);
    });
  });

  describe('with an active span', () => {
    const provider = new BasicTracerProvider();
    const contextManager = new AsyncLocalStorageContextManager();

    beforeAll(() => {
      contextManager.enable();
      context.setGlobalContextManager(contextManager);
      trace.setGlobalTracerProvider(provider);
    });

    afterAll(() => {
      contextManager.disable();
      context.disable();
      trace.disable();
    });

    it('takes the trace id from the span in context, without being passed one', () => {
      const tracer = trace.getTracer('correlation-spec');

      tracer.startActiveSpan('unit-of-work', (span) => {
        const expected = span.spanContext().traceId;

        // Read from a nested async call: the point is that nothing had to
        // thread the id through the call chain.
        const observed = (() => currentTraceId())();

        expect(observed).toBe(expected);
        expect(correlationId()).toBe(expected);
        span.end();
      });
    });
  });
});
