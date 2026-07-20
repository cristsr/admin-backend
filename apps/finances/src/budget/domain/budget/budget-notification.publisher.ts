import { BudgetThreshold } from './budget-threshold.enum';

/** Data carried when a budget crosses a spending threshold. */
export interface BudgetThresholdExceededPayload {
  budgetId: number;
  percentage: number;
  threshold: BudgetThreshold;
  user: number;
  /** Trace id propagated from the originating request (AC-4, sm-0004). */
  correlationId?: string;
}

/**
 * Publishes the budget threshold alert on a channel an external consumer
 * (frontend / notification service) reads. Replaces the placeholder log:
 * wiring a real channel means implementing this port (AC-1).
 */
export abstract class BudgetNotificationPublisher {
  abstract publish(payload: BudgetThresholdExceededPayload): Promise<void>;
}
