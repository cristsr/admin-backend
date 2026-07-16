import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { Repository } from 'typeorm';
import { Account, AccountRepository } from '../../../../../domain/account';
import { TypeOrmAccountEntity } from './typeorm-account.entity';
import { TypeOrmAccountMapper } from './typeorm-account.mapper';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    @InjectRepository(TypeOrmAccountEntity)
    private readonly repository: Repository<TypeOrmAccountEntity>,
  ) {}

  async findByIdAndUser(id: number, user: number): Promise<Nullable<Account>> {
    const entity = await this.repository.findOne({ where: { id, user } });
    return entity ? TypeOrmAccountMapper.toDomain(entity) : null;
  }

  async findAllByUser(active: boolean, user: number): Promise<Account[]> {
    const entities = await this.repository.find({ where: { active, user } });
    return entities.map(TypeOrmAccountMapper.toDomain);
  }

  async save(account: Account): Promise<Account> {
    const saved = await this.repository.save(
      TypeOrmAccountMapper.toEntity(account),
    );
    return TypeOrmAccountMapper.toDomain(saved as TypeOrmAccountEntity);
  }
}
