import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BudgetThresholdExceeded, BudgetThresholdExceededPayload } from '@app/budget/application/budget.constants';
import {
  Budget,
  BudgetCriteria,
  BudgetRepository,
  BudgetSpendingService,
} from '@app/budget/domain/budget';
import { MovementSaved, MovementSavedPayload } from '@app/movement/application/movement.constants';

/**
 * Reacts to every saved movement (via event, not a direct module dependency,
 * to avoid a movement<->budget circular import) and lets each matching budget
 * decide whether it just crossed a spending threshold.
 */
@Injectable()
export class MovementSavedEventHandler {
  private readonly logger = new Logger(MovementSavedEventHandler.name);

  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly budgetSpending: BudgetSpendingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(MovementSaved)
  async handle(payload: MovementSavedPayload): Promise<void> {
    this.logger.log(
      `Movement saved event received correlationId=${payload.correlationId ?? '-'}`,
    );

    const budgets = await this.budgetRepository.matching(
      BudgetCriteria.activeCovering({
        user: payload.user,
        category: payload.categoryId,
        account: payload.accountId,
        date: payload.date,
      }),
    );

    for (const budget of budgets) {
      await this.review(budget, payload.correlationId);
    }
  }

  /**
   * The budget owns both the arithmetic and the "notify once per threshold and
   * period" rule; a claimed breach is persisted before it is announced, so a
   * crash in between cannot turn into a duplicate alert.
   */
  private async review(
    budget: Budget,
    correlationId?: string,
  ): Promise<void> {
    await this.budgetSpending.recordSpending(budget);

    const threshold = budget.claimThresholdBreach();

    if (!threshold) return;

    await this.budgetRepository.save(budget);

    this.eventEmitter.emit(BudgetThresholdExceeded, {
      budgetId: budget.id,
      percentage: budget.percentage,
      threshold,
      user: budget.user,
      correlationId,
    } as BudgetThresholdExceededPayload);
  }
}
