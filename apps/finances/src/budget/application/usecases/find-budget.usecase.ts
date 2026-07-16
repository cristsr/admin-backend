import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import {
  MovementRepository,
  MovementType,
} from '../../../movement/domain/movement';
import { Budget, BudgetRepository } from '../../domain/budget';
import { UserBudgetFilterDto } from '../dto/budget-filter.dto';

@Injectable()
export class FindBudgetUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(
    filter: UserBudgetFilterDto,
    user: number,
  ): Promise<Nullable<Budget>> {
    const budget = await this.budgetRepository.findByIdAndUser(
      filter.budget,
      user,
    );

    if (!budget) return null;

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

    return budget;
  }
}
