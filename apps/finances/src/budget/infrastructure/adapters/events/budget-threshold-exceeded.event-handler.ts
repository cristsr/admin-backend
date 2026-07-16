import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BudgetThresholdExceeded,
  BudgetThresholdExceededPayload,
} from '../../../application/budget.constants';

/**
 * Placeholder for the eventual delivery channel (email/push/etc). For now it
 * only logs — wiring a real notifier just means listening to the same event.
 */
@Injectable()
export class BudgetThresholdExceededEventHandler {
  #logger = new Logger(BudgetThresholdExceededEventHandler.name);

  @OnEvent(BudgetThresholdExceeded)
  handle(payload: BudgetThresholdExceededPayload): void {
    this.#logger.warn(
      `Budget ${payload.budgetId} (user ${payload.user}) reached ${payload.percentage}% — threshold ${payload.threshold}`,
    );
  }
}
