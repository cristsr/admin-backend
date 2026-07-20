import { Budget } from '@app/budget/domain/budget';
import { BudgetOutputDto } from '../dto/budget-output.dto';

export class BudgetMapper {
  static toOutput(budget: Budget): BudgetOutputDto {
    return {
      id: budget.id,
      active: budget.active,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      name: budget.name,
      amount: budget.money.amount,
      currency: budget.money.currency,
      startDate: budget.startDate,
      endDate: budget.endDate,
      repeat: budget.repeat,
      period: budget.period,
      categoryId: budget.categoryId,
      accountId: budget.accountId,
      user: budget.user,
      spent: budget.spent?.amount ?? 0,
      percentage: budget.percentage ?? 0,
    };
  }
}
