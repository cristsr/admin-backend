import { RetryCounter } from '@cqrs/application/command-bus/policies/retry-counter';
import { Counter, metrics } from '@opentelemetry/api';

const METER_NAME = 'ledger.command-bus';
const METRIC_NAME = 'ledger.command.retries';
const COMMAND_TYPE_ATTRIBUTE = 'ledger.command.type';

/**
 * {@link RetryCounter} backed by an OpenTelemetry Counter (AC-8, RNF-12). The
 * fourth metric of RNF-12 — transient-persistence retries per command type —
 * implemented now without pulling in the rest of hu-0022.
 */
export class OtelRetryCounter extends RetryCounter {
  private readonly counter: Counter;

  constructor() {
    super();
    this.counter = metrics.getMeter(METER_NAME).createCounter(METRIC_NAME, {
      description: 'Transient-persistence retries per command type (AC-8).',
    });
  }

  increment(commandType: string): void {
    this.counter.add(1, { [COMMAND_TYPE_ATTRIBUTE]: commandType });
  }
}
