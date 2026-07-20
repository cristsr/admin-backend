import { Injectable } from '@nestjs/common';
import {
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import {
  Budget,
  BudgetNotFoundException,
  BudgetRepository,
} from '@app/budget/domain/budget';
import {
  CategoryNotFoundException,
  CategoryRepository,
} from '@app/category/domain/category';
import { Money } from '@app/shared/domain';
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
      money: Money.of(input.amount, input.currency),
      period: input.period,
      repeat: input.repeat,
      startDate: input.startDate,
      endDate: input.endDate,
      categoryId: category.id,
      accountId: account.id,
      user,
    } as Budget);

    const saved = await this.budgetRepository.save(budget);

    // A budget that was just created or edited has nothing spent against it yet
    // as far as the caller is concerned; the next read computes the real figure.
    saved.recordSpending(Money.zero(saved.money.currency));

    return saved;
  }
}
