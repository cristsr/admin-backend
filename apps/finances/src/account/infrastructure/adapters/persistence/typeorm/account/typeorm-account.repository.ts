import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { DataSource, Repository } from 'typeorm';
import { Account, AccountRepository } from '../../../../../domain/account';
import { TypeOrmAccountEntity } from './typeorm-account.entity';
import { TypeOrmAccountMapper } from './typeorm-account.mapper';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    @InjectRepository(TypeOrmAccountEntity)
    private readonly repository: Repository<TypeOrmAccountEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findByIdAndUser(id: number, user: number): Promise<Nullable<Account>> {
    const entity = await this.repository.findOne({ where: { id, user } });
    return entity ? TypeOrmAccountMapper.toDomain(entity) : null;
  }

  async findAllByUser(user: number): Promise<Account[]> {
    const entities = await this.repository.find({ where: { user } });
    return entities.map(TypeOrmAccountMapper.toDomain);
  }

  async save(account: Account): Promise<Account> {
    const saved = await this.repository.save(
      TypeOrmAccountMapper.toEntity(account),
    );
    return TypeOrmAccountMapper.toDomain(saved as TypeOrmAccountEntity);
  }

  async softRemove(id: number, user: number): Promise<boolean> {
    const result = await this.repository.softDelete({ id, user });
    return !!result.affected;
  }

  // Raw query on the movements table instead of the movement repository:
  // account is a leaf module that everything else depends on, so importing
  // the movement module here would create a cycle. The FK already couples
  // the two tables.
  async hasMovements(id: number): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM movements WHERE account_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  }
}
