import { metrics } from '@opentelemetry/api';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OtelRetryCounter } from './otel-retry-counter';

describe('OtelRetryCounter', () => {
  let exporter: InMemoryMetricExporter;
  let reader: PeriodicExportingMetricReader;

  beforeEach(() => {
    exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
  });

  afterEach(async () => {
    await reader.shutdown();
    metrics.disable();
  });

  it('records one count per command type with the command as attribute (AC-8)', async () => {
    const counter = new OtelRetryCounter();

    counter.increment('RecordTransactionCommand');
    counter.increment('RecordTransactionCommand');
    counter.increment('ConfirmTransactionCommand');

    await reader.forceFlush();

    const points = exporter
      .getMetrics()
      .flatMap((resource) => resource.scopeMetrics.flatMap((sm) => sm.metrics))
      .filter((metric) => metric.descriptor.name === 'ledger.command.retries')
      .flatMap((metric) =>
        metric.dataPoints.map((point) => ({
          commandType: point.attributes['ledger.command.type'] as string,
          value: typeof point.value === 'number' ? point.value : Number(point.value),
        })),
      );

    expect(points).toContainEqual({ commandType: 'RecordTransactionCommand', value: 2 });
    expect(points).toContainEqual({ commandType: 'ConfirmTransactionCommand', value: 1 });
  });
});
