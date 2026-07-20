import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/** How often metrics are pushed to the collector. */
const METRIC_EXPORT_INTERVAL_MS = 60_000;

const DEFAULT_SERVICE_NAME = 'finances';

/**
 * Reads straight from `process.env` rather than through `ConfigService`: the
 * SDK has to start before Nest exists, so there is no DI container to ask.
 */
export interface TelemetryEnvironment {
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_SERVICE_NAME?: string;
  OTEL_SDK_DISABLED?: string;
  npm_package_version?: string;
  ENV?: string;
  /** Everything else `process.env` carries; only the keys above are read. */
  [key: string]: string | undefined;
}

/**
 * Telemetry is opt-in: with no collector endpoint configured there is nothing
 * to send traces to, and starting the SDK anyway would only add overhead and
 * connection errors to every local run. `OTEL_SDK_DISABLED` is the standard
 * escape hatch and is honoured even when an endpoint is set.
 */
export function isTelemetryEnabled(env: TelemetryEnvironment): boolean {
  if (env.OTEL_SDK_DISABLED === 'true') return false;

  return !!env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
}

/**
 * The SDK wired for this service. Endpoint, headers and sampling come from the
 * standard `OTEL_*` variables, which the exporters read on their own — the only
 * thing set here is what identifies the service in the backend.
 *
 * `fs` instrumentation is left out on purpose: it produces a span per file
 * read, which buries the spans that describe actual work.
 */
export function buildNodeSDK(env: TelemetryEnvironment): NodeSDK {
  return new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: env.npm_package_version ?? '0.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.ENV ?? 'local',
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // Stamps trace_id/span_id onto every pino line, which is what links a
        // log to the request that produced it.
        '@opentelemetry/instrumentation-pino': { enabled: true },
      }),
    ],
  });
}
