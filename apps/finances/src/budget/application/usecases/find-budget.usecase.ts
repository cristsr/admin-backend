import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Budget, BudgetLookups, BudgetRepository, BudgetSpendingService } from '@app/budget/domain/budget';

@Injectable()
export class FindBudgetUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly budgetSpending: BudgetSpendingService,
  ) {}

  async execute(id: number, user: number): Promise<Nullable<Budget>> {
    const budget = await this.budgetRepository.firstMatching(BudgetLookups.byIdAndUser(id, user));

    if (!budget) return null;

    await this.budgetSpending.recordSpending(budget);

    return budget;
  }
}
