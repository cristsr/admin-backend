import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BudgetNotificationPublisher,
  BudgetThresholdExceededPayload,
} from '../../../domain/budget';
import { BudgetThresholdExceeded } from '../../../application/budget.constants';

/**
 * Delivers the threshold alert through the real channel (PGMQ queue) instead of
 * only logging it. The "once per threshold and period" deduplication is already
 * guaranteed by MovementSavedEventHandler via budgets.notified_threshold
 * (AC-1).
 */
@Injectable()
export class BudgetThresholdExceededEventHandler {
  constructor(private readonly publisher: BudgetNotificationPublisher) {}

  @OnEvent(BudgetThresholdExceeded)
  async handle(payload: BudgetThresholdExceededPayload): Promise<void> {
    await this.publisher.publish(payload);
  }
}
