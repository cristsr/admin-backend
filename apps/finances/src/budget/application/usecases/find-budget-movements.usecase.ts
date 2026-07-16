import { Injectable } from '@nestjs/common';
import { Movement, MovementRepository, MovementType } from '../../../movement/domain/movement';
import { BudgetRepository } from '../../domain/budget';

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
