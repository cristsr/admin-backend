import { BudgetThresholdExceededPayload } from './budget-threshold-exceeded-payload.type';

/** Port for publishing budget threshold alerts to an external consumer. */
export abstract class BudgetNotificationPublisher {
  abstract publish(payload: BudgetThresholdExceededPayload): Promise<void>;
}
