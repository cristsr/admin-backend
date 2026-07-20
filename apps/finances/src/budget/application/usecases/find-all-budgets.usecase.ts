import { Injectable } from '@nestjs/common';
import { CriteriaQueryDto } from '@shared';
import {
  Budget,
  BudgetCriteria,
  BudgetRepository,
  BudgetSpendingService,
} from '@app/budget/domain/budget';

@Injectable()
export class FindAllBudgetsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly budgetSpending: BudgetSpendingService,
  ) {}

  async execute(query: CriteriaQueryDto, user: number): Promise<Budget[]> {
    const budgets = await this.budgetRepository.matching(
      BudgetCriteria.list(query, user),
    );

    await this.budgetSpending.recordSpendingAll(budgets);

    return budgets;
  }
}
