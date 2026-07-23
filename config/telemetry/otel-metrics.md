# EP-5.4: OpenTelemetry Metrics for Ledger

## Instrumentation Points

All metrics are emitted via the OTel SDK (libs/shared/src/telemetry/).

### Command Execution Metrics

**Instrument:** `ledger.command.executions` (histogram)
- Attributes: `command_type`, `status` (success|concurrency_conflict|error)
- Records: command latency in milliseconds
- Use case: detect slow commands, command failure rate

```typescript
// In CommandPolicy wrapper
const duration = Date.now() - startTime;
meter.createHistogram('ledger.command.executions')
  .record(duration, { command_type: 'CreateAccount', status: 'success' });
```

**Instrument:** `ledger.command.concurrency_conflicts` (counter)
- Attributes: `command_type`, `aggregate_type`
- Records: total count of ConcurrencyConflictException
- Use case: detect hot aggregates, retry storms

```typescript
// In error path
meter.createCounter('ledger.command.concurrency_conflicts')
  .add(1, { command_type: 'Record Movement', aggregate_type: 'Account' });
```

### Projection Metrics

**Instrument:** `ledger.projection.lag` (gauge, seconds)
- Attributes: `projection_name`
- Records: `global_position - checkpoint.last_position`
- Use case: detect stalled projections, SLA monitoring

```typescript
// In ProjectionDispatcher after batch
const lag = latestEventPosition - checkpointPosition;
meter.createGauge('ledger.projection.lag')
  .record(lag / 1000, { projection_name: 'proj_accounts' });
```

**Instrument:** `ledger.projector.errors` (counter)
- Attributes: `projection_name`, `event_type`, `error_type`
- Records: projection failures (e.g., upsert fails)
- Use case: detect bad events, projector bugs

```typescript
// In Projector.project() exception handler
meter.createCounter('ledger.projector.errors')
  .add(1, { projection_name: 'proj_accounts', event_type: 'AccountCreated', error_type: 'UNIQUE_CONSTRAINT' });
```

### Reactor Metrics

**Instrument:** `ledger.reactor.errors` (counter)
- Attributes: `reactor_name`, `error_type`
- Records: reactor exceptions
- Use case: detect reactor bugs, failed side effects

```typescript
// In Reactor (e.g., GoalAchievementReactor)
try {
  // side effect logic
} catch (e) {
  meter.createCounter('ledger.reactor.errors')
    .add(1, { reactor_name: 'GoalAchievementReactor', error_type: e.name });
  throw e;
}
```

**Instrument:** `ledger.reactor.commands_dispatched` (counter)
- Attributes: `reactor_name`, `command_type`
- Records: commands emitted by reactor
- Use case: monitor reactor activity, side effect chains

```typescript
meter.createCounter('ledger.reactor.commands_dispatched')
  .add(1, { reactor_name: 'GoalAchievementReactor', command_type: 'MarkGoalAchieved' });
```

## Alerts

Configure alerts in your observability stack (Datadog, New Relic, etc.):

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| `ledger.projection.lag` | > 30 sec | WARN | Check app logs, restart if stalled |
| `ledger.command.concurrency_conflicts` | > 100/min | WARN | Investigate hot aggregate, add retry |
| `ledger.projector.errors` | > 0 | ALERT | Page oncall, stop writes until fixed |
| `ledger.reactor.errors` | > 0 | ALERT | Investigate side effect failure |

## Sampling

For high-volume environments:
- Commands: sample 10% of successful commands, 100% of errors
- Projections: sample lag every 5 seconds per projector
- Reactors: sample 100% (low volume expected)

## Dashboard Queries

### Command Success Rate (Prometheus)
```promql
rate(ledger_command_executions_total{status="success"}[5m]) / 
  rate(ledger_command_executions_total[5m])
```

### Projection Catch-Up Time
```promql
max(ledger_projection_lag) by (projection_name)
```

### Concurrency Conflict Rate
```promql
rate(ledger_command_concurrency_conflicts_total[5m])
```

## SDK Integration

Telemetry is initialized in `apps/ledger/src/config/telemetry.config.ts`:

```typescript
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

export function createMeterProvider() {
  const exporter = new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
  });
  const reader = new PeriodicExportingMetricReader({ exporter });
  return new MeterProvider({ readers: [reader] });
}
```

Enabled in `main.ts`:
```typescript
const meterProvider = createMeterProvider();
global.otel.meterProvider = meterProvider;
```
