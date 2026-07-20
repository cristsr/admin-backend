import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { DataSource, Repository } from 'typeorm';
import { Account, AccountRepository } from '@app/account/domain/account';
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
    if (!entity) return null;
    return TypeOrmAccountMapper.toDomain(entity);
  }

  async findAllByUser(user: number): Promise<Account[]> {
    const entities = await this.repository.find({ where: { user } });
    return entities.map(TypeOrmAccountMapper.toDomain);
  }

  async save(account: Account): Promise<Account> {
    const saved = await this.repository.save(TypeOrmAccountMapper.toEntity(account));
    return TypeOrmAccountMapper.toDomain(saved as TypeOrmAccountEntity);
  }

  async softRemove(id: number, user: number): Promise<boolean> {
    const result = await this.repository.softDelete({ id, user });
    return !!result.affected;
  }

  // Raw queries again to avoid the module cycle with movement (see hasMovements).
  async archiveCascade(id: number, user: number): Promise<{ archivedMovements: number; archivedTransfers: number }> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Soft-delete every movement of this account (transfer legs included).
      const movements: Array<{ transfer_group: string | null }> = await manager.query(
        `UPDATE movements SET deleted_at = NOW()
           WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL
           RETURNING transfer_group`,
        [id, user],
      );

      const archivedMovements = movements.length;
      const groups = [
        ...new Set(movements.map((movement) => movement.transfer_group).filter((group): group is string => !!group)),
      ];

      // 2. Soft-delete the counterpart legs so no transfer is left half-valid,
      //    even if the other account is still active.
      if (groups.length > 0) {
        await manager.query(
          `UPDATE movements SET deleted_at = NOW()
           WHERE user_id = $1 AND deleted_at IS NULL AND transfer_group = ANY($2)`,
          [user, groups],
        );
      }

      // 3. Soft-delete the account itself.
      await manager.query(
        `UPDATE accounts SET deleted_at = NOW()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [id, user],
      );

      return { archivedMovements, archivedTransfers: groups.length };
    });
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

  async movementBalancesByUser(user: number): Promise<Record<number, number>> {
    const rows: Array<{ account_id: number; total: string }> = await this.dataSource.query(
      `SELECT account_id, ${TypeOrmAccountRepository.SIGNED_SUM} AS total ` +
        `FROM movements WHERE user_id = $1 AND deleted_at IS NULL ` +
        `GROUP BY account_id`,
      [user],
    );
    return rows.reduce((acc, row) => ({ ...acc, [row.account_id]: Number(row.total) }), {} as Record<number, number>);
  }
}
