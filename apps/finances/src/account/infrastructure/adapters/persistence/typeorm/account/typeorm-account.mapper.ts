import { Account } from '../../../../../domain/account';
import { TypeOrmAccountEntity } from './typeorm-account.entity';

export class TypeOrmAccountMapper {
  static toDomain(entity: TypeOrmAccountEntity): Account {
    return Account.create({
      id: entity.id,
      active: entity.active,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
      name: entity.name,
      initialBalance: entity.initialBalance,
      currency: entity.currency,
      user: entity.user,
    });
  }

  static toEntity(account: Account): Partial<TypeOrmAccountEntity> {
    return {
      id: account.id,
      name: account.name,
      initialBalance: account.initialBalance,
      currency: account.currency,
      user: account.user,
    };
  }
}
