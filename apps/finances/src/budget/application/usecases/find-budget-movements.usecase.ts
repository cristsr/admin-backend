import { Injectable } from '@nestjs/common';
import { BudgetCriteria, BudgetRepository } from '@app/budget/domain/budget';
import {
  Movement,
  MovementCriteria,
  MovementRepository,
  MovementType,
} from '@app/movement/domain/movement';

@Injectable()
export class FindBudgetMovementsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(id: number, user: number): Promise<Movement[]> {
    const budget = await this.budgetRepository.firstMatching(
      BudgetCriteria.byIdAndUser(id, user),
    );

    if (!budget) return [];

    // No currency filter: this lists what the budget covers, not its total.
    return this.movementRepository.matching(
      MovementCriteria.spendingIn({
        user,
        category: budget.categoryId,
        type: MovementType.EXPENSE,
        startDate: budget.startDate,
        endDate: budget.endDate,
      }),
    );
  }
}
