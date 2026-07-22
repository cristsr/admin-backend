import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User, UserRepository } from '@app/user/domain/user';
import { TypeOrmUserEntity } from './typeorm-user.entity';
import { TypeOrmUserMapper } from './typeorm-user.mapper';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(TypeOrmUserEntity)
    private readonly repository: Repository<TypeOrmUserEntity>,
  ) {}

  async findAll(): Promise<User[]> {
    const entities = await this.repository.find();
    return entities.map(TypeOrmUserMapper.toDomain);
  }

  async findById(id: number): Promise<Nullable<User>> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TypeOrmUserMapper.toDomain(entity) : null;
  }

  async findByExternalId(externalId: string): Promise<Nullable<User>> {
    const entity = await this.repository.findOne({ where: { externalId } });
    return entity ? TypeOrmUserMapper.toDomain(entity) : null;
  }

  async findByEmailOrExternalId(email: string, externalId: Nullable<string>): Promise<Nullable<User>> {
    const where: FindOptionsWhere<TypeOrmUserEntity>[] = [{ email }];
    if (externalId) where.push({ externalId });

    const entity = await this.repository.findOne({ where });
    return entity ? TypeOrmUserMapper.toDomain(entity) : null;
  }

  async save(user: User): Promise<User> {
    const saved = await this.repository.save(TypeOrmUserMapper.toEntity(user));
    return TypeOrmUserMapper.toDomain(saved as TypeOrmUserEntity);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return !!result.affected;
  }
}
