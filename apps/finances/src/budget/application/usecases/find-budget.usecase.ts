import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { MovementRepository } from '../../../movement/domain/movement';
import { Budget, BudgetRepository } from '../../domain/budget';
import { UserBudgetFilterDto } from '../dto/budget-filter.dto';

@Injectable()
export class FindBudgetUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(filter: UserBudgetFilterDto): Promise<Nullable<Budget>> {
    const budget = await this.budgetRepository.findByIdAndUser(
      filter.budget,
      filter.user,
    );

    if (!budget) return null;

    const spent = await this.movementRepository.sumAmountByCategoryAndDateRange(
      budget.categoryId,
      budget.startDate,
      budget.endDate,
    );

    budget.spent = spent;
    budget.percentage = Math.floor((spent / budget.amount) * 100);

    return budget;
  }
}
