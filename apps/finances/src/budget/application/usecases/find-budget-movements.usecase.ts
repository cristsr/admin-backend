import { Injectable } from '@nestjs/common';
import { BudgetLookups, BudgetRepository } from '@app/budget/domain/budget';
import { Movement, MovementReports, MovementRepository, MovementType } from '@app/movement/domain/movement';

@Injectable()
export class FindBudgetMovementsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(id: number, user: number): Promise<Movement[]> {
    const budget = await this.budgetRepository.firstMatching(BudgetLookups.byIdAndUser(id, user));

    if (!budget) return [];

    // No currency filter: this lists what the budget covers, not its total.
    return this.movementRepository.matching(
      MovementReports.spendingIn({
        user,
        category: budget.categoryId,
        type: MovementType.EXPENSE,
        startDate: budget.startDate,
        endDate: budget.endDate,
      }),
    );
  }
}
