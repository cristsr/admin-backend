import { Injectable } from '@nestjs/common';
import {
  MovementCriteria,
  MovementRepository,
  MovementType,
} from '@app/movement/domain/movement';
import { Money } from '@app/shared/domain';
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

    // The repository answers a bare total; the currency it is expressed in is
    // the one this service just filtered by, so labelling it belongs here.
    budget.recordSpending(Money.of(total, currency));
  }

  async recordSpendingAll(budgets: Budget[]): Promise<void> {
    await Promise.all(budgets.map((budget) => this.recordSpending(budget)));
  }
}
