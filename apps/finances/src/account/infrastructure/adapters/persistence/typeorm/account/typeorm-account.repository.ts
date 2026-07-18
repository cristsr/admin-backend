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

  // Signed sum reusing the raw-query approach of hasMovements to avoid a
  // module cycle with the movement module. INCOME/TRANSFER_IN add,
  // EXPENSE/TRANSFER_OUT subtract; soft-deleted rows are excluded.
  private static readonly SIGNED_SUM =
    `COALESCE(SUM(CASE ` +
    `WHEN type IN ('INCOME','TRANSFER_IN') THEN amount ` +
    `WHEN type IN ('EXPENSE','TRANSFER_OUT') THEN -amount ELSE 0 END), 0)`;

  async movementBalance(accountId: number, user: number): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT ${TypeOrmAccountRepository.SIGNED_SUM} AS total ` +
        `FROM movements WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [accountId, user],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async movementBalancesByUser(
    user: number,
  ): Promise<Record<number, number>> {
    const rows: Array<{ account_id: number; total: string }> =
      await this.dataSource.query(
        `SELECT account_id, ${TypeOrmAccountRepository.SIGNED_SUM} AS total ` +
          `FROM movements WHERE user_id = $1 AND deleted_at IS NULL ` +
          `GROUP BY account_id`,
        [user],
      );
    return rows.reduce(
      (acc, row) => ({ ...acc, [row.account_id]: Number(row.total) }),
      {} as Record<number, number>,
    );
  }
}
