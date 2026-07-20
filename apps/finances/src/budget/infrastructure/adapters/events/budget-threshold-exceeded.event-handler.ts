import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BudgetThresholdExceeded } from '@app/budget/application/budget.constants';
import { BudgetNotificationPublisher, BudgetThresholdExceededPayload } from '@app/budget/domain/budget';

/**
 * Delivers the threshold alert through the real channel (PGMQ queue) instead of
 * only logging it. The "once per threshold and period" deduplication is already
 * guaranteed by MovementSavedEventHandler via budgets.notified_threshold
 * (AC-1).
 */
@Injectable()
export class BudgetThresholdExceededEventHandler {
  private readonly logger = new Logger(
    BudgetThresholdExceededEventHandler.name,
  );

  constructor(private readonly publisher: BudgetNotificationPublisher) {}

  @OnEvent(BudgetThresholdExceeded)
  async handle(payload: BudgetThresholdExceededPayload): Promise<void> {
    this.logger.log(
      `BudgetThresholdExceeded budgetId=${payload.budgetId} threshold=${payload.threshold} correlationId=${payload.correlationId ?? '-'}`,
    );
    await this.publisher.publish(payload);
  }
}
