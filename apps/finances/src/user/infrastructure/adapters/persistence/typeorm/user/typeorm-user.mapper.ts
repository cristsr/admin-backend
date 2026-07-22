import { User } from '@app/user/domain/user';
import { TypeOrmUserEntity } from './typeorm-user.entity';

export class TypeOrmUserMapper {
  static toDomain(entity: TypeOrmUserEntity): User {
    return User.create({
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      name: entity.name,
      lastName: entity.lastName,
      email: entity.email,
      externalId: entity.externalId ?? null,
    });
  }

  static toEntity(user: User): Partial<TypeOrmUserEntity> {
    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      externalId: user.externalId ?? undefined,
    };
  }
}
