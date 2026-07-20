import { Account } from '@app/account/domain/account';
import { Money } from '@app/shared/domain';
import { TypeOrmAccountEntity } from './typeorm-account.entity';

export class TypeOrmAccountMapper {
  static toDomain(entity: TypeOrmAccountEntity): Account {
    return Account.create({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      name: entity.name,
      initialBalance: Money.of(entity.initialBalance, entity.currency),
      allowNegativeBalance: entity.allowNegativeBalance,
      user: entity.user,
    });
  }

  static toEntity(account: Account): Partial<TypeOrmAccountEntity> {
    return {
      id: account.id,
      name: account.name,
      initialBalance: account.initialBalance.amount,
      currency: account.currencyCode(),
      allowNegativeBalance: account.allowNegativeBalance,
      user: account.user,
    };
  }
}
