import { Injectable } from '@nestjs/common';
import { BudgetCriteria, BudgetRepository } from '@app/budget/domain/budget';

@Injectable()
export class RemoveBudgetUsecase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const removed = await this.budgetRepository.removeMatching(
      BudgetCriteria.byIdAndUser(id, user),
    );

    return !!removed;
  }
}
