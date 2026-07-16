import { Injectable } from '@nestjs/common';
import { normalizePagination } from '@shared';
import { MovementRepository } from '../../../movement/domain/movement';
import { Budget, BudgetRepository } from '../../domain/budget';
import { BudgetFilterDto } from '../dto/budget-filter.dto';

@Injectable()
export class FindAllBudgetsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(filter: BudgetFilterDto): Promise<Budget[]> {
    const { take, skip } = normalizePagination(filter);
    const budgets = await this.budgetRepository.findAll({
      ...filter,
      take,
      skip,
    });

    for (const budget of budgets) {
      const spent =
        await this.movementRepository.sumAmountByCategoryAndDateRange(
          budget.categoryId,
          budget.startDate,
          budget.endDate,
        );

      budget.spent = spent;
      budget.percentage = Math.floor((spent / budget.amount) * 100);
    }

    return budgets;
  }
}
