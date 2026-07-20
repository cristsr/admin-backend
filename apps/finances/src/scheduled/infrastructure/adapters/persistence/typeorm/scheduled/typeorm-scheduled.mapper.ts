import { Scheduled } from '@app/scheduled/domain/scheduled';
import { Money } from '@app/shared/domain';
import { TypeOrmScheduledEntity } from './typeorm-scheduled.entity';

export class TypeOrmScheduledMapper {
  static toDomain(entity: TypeOrmScheduledEntity): Scheduled {
    return Scheduled.create({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      date: entity.date,
      type: entity.type,
      description: entity.description,
      money: Money.of(entity.amount, entity.currency),
      categoryId: entity.categoryId,
      subcategoryId: entity.subcategoryId,
      accountId: entity.accountId,
      frequency: entity.frequency,
      user: entity.user,
    });
  }

  static toEntity(scheduled: Scheduled): Partial<TypeOrmScheduledEntity> {
    return {
      id: scheduled.id,
      date: scheduled.date,
      type: scheduled.type,
      description: scheduled.description,
      amount: scheduled.money.amount,
      currency: scheduled.money.currency,
      frequency: scheduled.frequency,
      category: { id: scheduled.categoryId } as TypeOrmScheduledEntity['category'],
      subcategory: { id: scheduled.subcategoryId } as TypeOrmScheduledEntity['subcategory'],
      account: { id: scheduled.accountId } as TypeOrmScheduledEntity['account'],
      user: scheduled.user,
    };
  }
}
