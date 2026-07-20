import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { buildNodeSDK, isTelemetryEnabled } from './telemetry.config';

/**
 * Starts OpenTelemetry. This module must be loaded before anything else in the
 * process: the auto-instrumentations work by patching modules as they are
 * required, so anything imported earlier (http, express, pg, pino) is already
 * loaded and stays invisible to tracing. That is why `main.ts` imports this
 * first, ahead of even `AppModule`.
 *
 * Failing to reach the collector must never take the service down — telemetry
 * is a diagnostic, not a dependency — so startup errors are reported through
 * the OTel diagnostic channel and the process carries on uninstrumented.
 */
function startTelemetry(): void {
  if (!isTelemetryEnabled(process.env)) return;

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  let sdk: NodeSDK;

  try {
    sdk = buildNodeSDK(process.env);
    sdk.start();
  } catch (error) {
    diag.error('OpenTelemetry failed to start; continuing without it', error);
    return;
  }

  // Flush whatever is buffered before the process goes away, otherwise the
  // spans of the request that triggered the shutdown are lost.
  const shutdown = () => {
    sdk
      .shutdown()
      .catch((error) => diag.error('OpenTelemetry shutdown failed', error))
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startTelemetry();
