import { Injectable } from '@nestjs/common';
import {
  MovementRepository,
  MovementType,
} from '@app/movement/domain/movement';
import { Budget } from './budget.entity';

/**
 * Loads what has been spent against a budget during its own period and hands it
 * to the budget to record. Lives in the domain because "what counts as spending
 * for a budget" — expenses only, same category, same account, inside the period
 * and in the budget's own currency — is a business rule, not a query detail,
 * and every read of a budget must answer it the same way.
 */
@Injectable()
export class BudgetSpendingService {
  constructor(private readonly movementRepository: MovementRepository) {}

  async recordSpending(budget: Budget): Promise<void> {
    const spent = await this.movementRepository.sumAmount({
      user: budget.user,
      category: budget.categoryId,
      account: budget.accountId,
      startDate: budget.startDate,
      endDate: budget.endDate,
      type: MovementType.EXPENSE,
      currency: budget.money.currency,
    });

    budget.recordSpending(spent);
  }

  async recordSpendingAll(budgets: Budget[]): Promise<void> {
    await Promise.all(budgets.map((budget) => this.recordSpending(budget)));
  }
}
