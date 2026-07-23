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
import { TelemetryEnvironment } from './telemetry-environment.type';

const METRIC_EXPORT_INTERVAL_MS = 60_000;

/**
 * Fallback when `OTEL_SERVICE_NAME` is unset, per the OpenTelemetry
 * specification's unknown-service convention. Every app should declare its own
 * `OTEL_SERVICE_NAME` (e.g. `finances`, `ledger`) so backends can tell them
 * apart.
 */
const DEFAULT_SERVICE_NAME = 'unknown_service';

/**
 * Telemetry is opt-in: off without a collector endpoint, or when the standard
 * `OTEL_SDK_DISABLED` kill switch is set.
 */
export function isTelemetryEnabled(env: TelemetryEnvironment): boolean {
  if (env.OTEL_SDK_DISABLED === 'true') return false;

  return !!env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
}

/**
 * Only the resource identity is set here; endpoint, headers and sampling come
 * from the standard `OTEL_*` variables the exporters read themselves.
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
        // Disabled: one span per file read buries the spans that matter.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // Stamps trace_id/span_id onto every pino line, linking a log to its request.
        '@opentelemetry/instrumentation-pino': { enabled: true },
      }),
    ],
  });
}
