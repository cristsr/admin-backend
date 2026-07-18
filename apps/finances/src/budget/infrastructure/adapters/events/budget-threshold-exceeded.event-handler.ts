import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BudgetNotificationPublisher,
  BudgetThresholdExceededPayload,
} from '../../../domain/budget';
import { BudgetThresholdExceeded } from '../../../application/budget.constants';

/**
 * Entrega la alerta de umbral por el canal real (cola PGMQ) en vez de solo
 * loguearla. La deduplicación "una vez por umbral y período" ya la garantiza
 * MovementSavedEventHandler vía budgets.notified_threshold (AC-1).
 */
@Injectable()
export class BudgetThresholdExceededEventHandler {
  constructor(private readonly publisher: BudgetNotificationPublisher) {}

  @OnEvent(BudgetThresholdExceeded)
  async handle(payload: BudgetThresholdExceededPayload): Promise<void> {
    await this.publisher.publish(payload);
  }
}
