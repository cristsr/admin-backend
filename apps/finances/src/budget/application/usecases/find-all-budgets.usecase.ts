import { Injectable } from '@nestjs/common';
import { normalizePagination } from '@shared';
import {
  MovementRepository,
  MovementType,
} from '../../../movement/domain/movement';
import { Budget, BudgetRepository } from '../../domain/budget';
import { BudgetFilterDto } from '../dto/budget-filter.dto';

@Injectable()
export class FindAllBudgetsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(filter: BudgetFilterDto, user: number): Promise<Budget[]> {
    const { take, skip } = normalizePagination(filter);
    const budgets = await this.budgetRepository.findAll({
      ...filter,
      user,
      take,
      skip,
    });

    for (const budget of budgets) {
      const spent = await this.movementRepository.sumAmount({
        user,
        category: budget.categoryId,
        account: budget.accountId,
        startDate: budget.startDate,
        endDate: budget.endDate,
        type: MovementType.EXPENSE,
      });

      budget.spent = spent;
      budget.percentage = Math.floor((spent / budget.amount) * 100);
    }

    return budgets;
  }
}
