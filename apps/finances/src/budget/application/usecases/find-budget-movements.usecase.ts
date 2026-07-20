import { Injectable } from '@nestjs/common';
import { BudgetRepository } from '@app/budget/domain/budget';
import {
  Movement,
  MovementRepository,
  MovementType,
} from '@app/movement/domain/movement';

@Injectable()
export class FindBudgetMovementsUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly movementRepository: MovementRepository,
  ) {}

  async execute(id: number, user: number): Promise<Movement[]> {
    const budget = await this.budgetRepository.findByIdAndUser(id, user);

    if (!budget) return [];

    return this.movementRepository.findAll({
      user,
      startDate: budget.startDate,
      endDate: budget.endDate,
      category: budget.categoryId,
      type: [MovementType.EXPENSE],
    });
  }
}
