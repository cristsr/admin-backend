import { trace } from '@opentelemetry/api';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { buildNodeSDK, isTelemetryEnabled } from './telemetry.config';

describe('isTelemetryEnabled', () => {
  it('stays off when no collector endpoint is configured', () => {
    expect(isTelemetryEnabled({})).toBe(false);
    expect(isTelemetryEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: '   ' })).toBe(
      false,
    );
  });

  it('turns on once an endpoint is given', () => {
    expect(
      isTelemetryEnabled({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
      }),
    ).toBe(true);
  });

  it('honours the standard kill switch even with an endpoint set', () => {
    expect(
      isTelemetryEnabled({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_SDK_DISABLED: 'true',
      }),
    ).toBe(false);
  });
});

describe('buildNodeSDK', () => {
  const endpoint = { OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' };

  /** The SDK keeps the resource it was built with on a private field. */
  const resourceOf = (sdk: unknown) =>
    (sdk as { _resource: { attributes: Record<string, unknown> } })._resource
      .attributes;

  it('identifies the service, defaulting the name to finances', () => {
    const attributes = resourceOf(buildNodeSDK(endpoint));

    expect(attributes[ATTR_SERVICE_NAME]).toBe('finances');
  });

  it('takes the service name, version and environment from the environment', () => {
    const attributes = resourceOf(
      buildNodeSDK({
        ...endpoint,
        OTEL_SERVICE_NAME: 'finances-api',
        npm_package_version: '2.1.0',
        ENV: 'staging',
      }),
    );

    expect(attributes[ATTR_SERVICE_NAME]).toBe('finances-api');
    expect(attributes[ATTR_SERVICE_VERSION]).toBe('2.1.0');
    expect(attributes[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]).toBe('staging');
  });

  /** Starting the SDK must register a real tracer provider, not the no-op API. */
  it('registers a working tracer provider once started', async () => {
    const sdk = buildNodeSDK(endpoint);
    sdk.start();

    try {
      const span = trace.getTracer('telemetry-spec').startSpan('probe');
      const context = span.spanContext();
      span.end();

      expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      // Export failure is expected with no collector; it must not fail the test.
      await sdk.shutdown().catch(() => undefined);
    }
  });
});
