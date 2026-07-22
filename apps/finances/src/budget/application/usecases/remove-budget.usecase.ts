import { Injectable } from '@nestjs/common';
import { BudgetLookups, BudgetRepository } from '@app/budget/domain/budget';

@Injectable()
export class RemoveBudgetUsecase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const removed = await this.budgetRepository.removeMatching(BudgetLookups.byIdAndUser(id, user));

    return !!removed;
  }
}
