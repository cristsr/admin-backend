import { Injectable } from '@nestjs/common';
import { CriteriaQueryDto } from '@shared';
import { Budget, BudgetListing, BudgetRepository, BudgetSpendingService } from '@app/budget/domain/budget';

@Injectable()
export class FindAllBudgetsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly budgetSpending: BudgetSpendingService,
  ) {}

  async execute(query: CriteriaQueryDto, user: number): Promise<Budget[]> {
    const budgets = await this.budgetRepository.matching(BudgetListing.fromQuery(query, user));

    await this.budgetSpending.recordSpendingAll(budgets);

    return budgets;
  }
}
