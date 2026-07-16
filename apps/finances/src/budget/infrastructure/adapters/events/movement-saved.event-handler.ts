import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MovementSaved, MovementSavedPayload } from '../../../../movement/application/movement.constants';
import {
  MovementRepository,
  MovementType,
} from '../../../../movement/domain/movement';
import { BudgetRepository } from '../../../domain/budget';
import {
  BUDGET_THRESHOLD_LIMITS,
  BudgetThreshold,
  BudgetThresholdExceeded,
  BudgetThresholdExceededPayload,
} from '../../../application/budget.constants';

/**
 * Reacts to every saved movement (via event, not a direct module dependency,
 * to avoid a movement<->budget circular import) and checks whether any
 * matching active budget just crossed a spending threshold.
 */
@Injectable()
export class MovementSavedEventHandler {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(MovementSaved)
  async handle(payload: MovementSavedPayload): Promise<void> {
    const budgets = await this.budgetRepository.findActiveMatching(
      payload.categoryId,
      payload.accountId,
      payload.date,
      payload.user,
    );

    for (const budget of budgets) {
      const spent = await this.movementRepository.sumAmount({
        user: budget.user,
        category: budget.categoryId,
        account: budget.accountId,
        startDate: budget.startDate,
        endDate: budget.endDate,
        type: MovementType.EXPENSE,
      });

      const percentage = Math.floor((spent / budget.amount) * 100);

      const threshold = [BudgetThreshold.EXCEEDED, BudgetThreshold.WARNING].find(
        (candidate) => percentage >= BUDGET_THRESHOLD_LIMITS[candidate],
      );

      if (!threshold) continue;

      this.eventEmitter.emit(BudgetThresholdExceeded, {
        budgetId: budget.id,
        percentage,
        threshold,
        user: budget.user,
      } as BudgetThresholdExceededPayload);
    }
  }
}
