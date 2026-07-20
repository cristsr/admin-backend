import { Injectable } from '@nestjs/common';
import { BudgetRepository } from '@app/budget/domain/budget';

@Injectable()
export class RemoveBudgetUsecase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    return this.budgetRepository.softRemove(id, user);
  }
}
