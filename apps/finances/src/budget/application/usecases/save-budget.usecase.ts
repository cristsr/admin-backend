import { Injectable } from '@nestjs/common';
import { AccountNotFoundException, AccountRepository } from '../../../account/domain/account';
import { CategoryNotFoundException, CategoryRepository } from '../../../category/domain/category';
import { Budget, BudgetNotFoundException, BudgetRepository } from '../../domain/budget';
import { BudgetInputDto } from '../dto/budget-input.dto';

@Injectable()
export class SaveBudgetUsecase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: BudgetInputDto, user: number): Promise<Budget> {
    const [existing, category, account] = await Promise.all([
      input.id ? this.budgetRepository.findByIdAndUser(input.id, user) : null,
      this.categoryRepository.findById(input.category),
      this.accountRepository.findByIdAndUser(input.account, user),
    ]);

    if (input.id && !existing) {
      throw new BudgetNotFoundException('Budget not found');
    }

    if (!category) {
      throw new CategoryNotFoundException('Category not found');
    }

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const budget = Budget.create({
      ...existing,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      period: input.period,
      repeat: input.repeat,
      startDate: input.startDate,
      endDate: input.endDate,
      categoryId: category.id,
      accountId: account.id,
      user,
    } as Budget);

    const saved = await this.budgetRepository.save(budget);
    saved.spent = 0;
    saved.percentage = 0;

    return saved;
  }
}
