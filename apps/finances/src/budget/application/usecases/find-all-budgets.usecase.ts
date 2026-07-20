import { Injectable } from '@nestjs/common';
import { normalizePagination } from '@shared';
import {
  Budget,
  BudgetRepository,
  BudgetSpendingService,
} from '@app/budget/domain/budget';
import { BudgetFilterDto } from '../dto/budget-filter.dto';

@Injectable()
export class FindAllBudgetsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly budgetSpending: BudgetSpendingService,
  ) {}

  async execute(filter: BudgetFilterDto, user: number): Promise<Budget[]> {
    const { take, skip } = normalizePagination(filter);
    const budgets = await this.budgetRepository.findAll({
      ...filter,
      user,
      take,
      skip,
    });

    await this.budgetSpending.recordSpendingAll(budgets);

    return budgets;
  }
}
