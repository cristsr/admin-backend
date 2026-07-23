import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { buildNodeSDK, isTelemetryEnabled } from './telemetry.config';

/**
 * Starts OpenTelemetry; must load first, since auto-instrumentations patch
 * modules at require time. Collector failures never take the service down.
 *
 * Deliberately excluded from the `@shared` barrel: importing this module has
 * the side effect of starting the SDK, so each app imports it directly — as
 * `@shared/telemetry/instrumentation` — on the very first line of `main.ts`.
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

  // Flush buffered spans before exit, otherwise the triggering request's spans are lost.
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
