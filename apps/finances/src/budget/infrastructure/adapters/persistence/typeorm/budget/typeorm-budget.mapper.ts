import { Budget } from '../../../../../domain/budget';
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
      amount: entity.amount,
      currency: entity.currency,
      startDate: entity.startDate,
      endDate: entity.endDate,
      repeat: entity.repeat,
      period: entity.period,
      categoryId: entity.categoryId,
      accountId: entity.accountId,
      user: entity.user,
    });
  }

  static toEntity(budget: Budget): Partial<TypeOrmBudgetEntity> {
    return {
      id: budget.id,
      name: budget.name,
      amount: budget.amount,
      currency: budget.currency,
      startDate: budget.startDate,
      endDate: budget.endDate,
      repeat: budget.repeat,
      period: budget.period,
      category: { id: budget.categoryId } as TypeOrmBudgetEntity['category'],
      account: { id: budget.accountId } as TypeOrmBudgetEntity['account'],
      user: budget.user,
    };
  }
}
