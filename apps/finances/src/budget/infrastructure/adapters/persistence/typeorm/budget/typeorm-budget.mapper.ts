import { Budget } from '@app/budget/domain/budget';
import { Money } from '@app/shared/domain';
import { TypeOrmBudgetEntity } from './typeorm-budget.entity';

export class TypeOrmBudgetMapper {
  static toDomain(entity: TypeOrmBudgetEntity): Budget {
    return Budget.create({
      id: entity.id,
      active: entity.active,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      name: entity.name,
      money: Money.of(entity.amount, entity.currency),
      startDate: entity.startDate,
      endDate: entity.endDate,
      repeat: entity.repeat,
      period: entity.period,
      notifiedThreshold: entity.notifiedThreshold ?? undefined,
      categoryId: entity.categoryId,
      accountId: entity.accountId,
      user: entity.user,
    });
  }

  static toEntity(budget: Budget): Partial<TypeOrmBudgetEntity> {
    return {
      id: budget.id,
      name: budget.name,
      amount: budget.money.amount,
      currency: budget.money.currency,
      startDate: budget.startDate,
      endDate: budget.endDate,
      repeat: budget.repeat,
      period: budget.period,
      notifiedThreshold: budget.notifiedThreshold ?? null,
      category: { id: budget.categoryId } as TypeOrmBudgetEntity['category'],
      account: { id: budget.accountId } as TypeOrmBudgetEntity['account'],
      user: budget.user,
    };
  }
}
