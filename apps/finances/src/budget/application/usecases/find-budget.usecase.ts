import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import {
  Budget,
  BudgetRepository,
  BudgetSpendingService,
} from '@app/budget/domain/budget';
import { UserBudgetFilterDto } from '../dto/budget-filter.dto';

@Injectable()
export class FindBudgetUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly budgetSpending: BudgetSpendingService,
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

    await this.budgetSpending.recordSpending(budget);

    return budget;
  }
}
