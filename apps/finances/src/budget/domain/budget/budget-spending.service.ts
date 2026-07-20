import { Injectable } from '@nestjs/common';
import {
  MovementCriteria,
  MovementRepository,
  MovementType,
} from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
import { Budget } from './budget.entity';

/**
 * Records on a budget what has been spent against it; what counts as
 * spending is a business rule shared by every read of a budget.
 */
@Injectable()
export class BudgetSpendingService {
  constructor(private readonly movementRepository: MovementRepository) {}

  async recordSpending(budget: Budget): Promise<void> {
    const currency = budget.money.currency;

    const total = await this.movementRepository.sumAmount(
      MovementCriteria.spendingIn({
        user: budget.user,
        category: budget.categoryId,
        account: budget.accountId,
        startDate: budget.startDate,
        endDate: budget.endDate,
        type: MovementType.EXPENSE,
        currency,
      }),
    );

    // The bare total is in the currency just filtered by; label it here.
    budget.recordSpending(Money.of(total, currency));
  }

  async recordSpendingAll(budgets: Budget[]): Promise<void> {
    await Promise.all(budgets.map((budget) => this.recordSpending(budget)));
  }
}
