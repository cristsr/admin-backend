import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Criteria, Nullable, TypeOrmCriteriaConverter } from '@shared';
import { DataSource, Repository } from 'typeorm';
import { Account, AccountArchiveResult, AccountField, AccountRepository } from '@app/account/domain/account';
import { ACCOUNT_CRITERIA_FIELDS } from './typeorm-account.criteria-fields';
import { TypeOrmAccountEntity } from './typeorm-account.entity';
import { TypeOrmAccountMapper } from './typeorm-account.mapper';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    @InjectRepository(TypeOrmAccountEntity)
    private readonly repository: Repository<TypeOrmAccountEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async matching(criteria: Criteria<AccountField>): Promise<Account[]> {
    const entities = await this.repository.find(
      TypeOrmCriteriaConverter.toFindOptions<TypeOrmAccountEntity, AccountField>(
        ACCOUNT_CRITERIA_FIELDS,
        criteria,
      ),
    );

    return entities.map(TypeOrmAccountMapper.toDomain);
  }

  async firstMatching(criteria: Criteria<AccountField>): Promise<Nullable<Account>> {
    const entity = await this.repository.findOne(
      TypeOrmCriteriaConverter.toFindOptions<TypeOrmAccountEntity, AccountField>(
        ACCOUNT_CRITERIA_FIELDS,
        criteria,
      ),
    );

    if (!entity) return null;

    return TypeOrmAccountMapper.toDomain(entity);
  }

  async save(account: Account): Promise<Account> {
    const saved = await this.repository.save(TypeOrmAccountMapper.toEntity(account));
    return TypeOrmAccountMapper.toDomain(saved as TypeOrmAccountEntity);
  }

  // Raw queries avoid the module cycle with movement (see the port).
  async archiveCascade(id: number, user: number): Promise<AccountArchiveResult> {
    return this.dataSource.transaction(async (manager) => {
      const movements: Array<{ transfer_group: Nullable<string> }> = await manager.query(
        `UPDATE movements SET deleted_at = NOW()
           WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL
           RETURNING transfer_group`,
        [id, user],
      );

      const archivedMovements = movements.length;
      const groups = [
        ...new Set(
          movements.map((movement) => movement.transfer_group).filter((group): group is string => !!group),
        ),
      ];

      // Counterpart legs too, so no transfer is left half-valid.
      if (groups.length > 0) {
        await manager.query(
          `UPDATE movements SET deleted_at = NOW()
           WHERE user_id = $1 AND deleted_at IS NULL AND transfer_group = ANY($2)`,
          [user, groups],
        );
      }

      await manager.query(
        `UPDATE accounts SET deleted_at = NOW()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [id, user],
      );

      return { archivedMovements, archivedTransfers: groups.length };
    });
  }

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
    return rows.reduce(
      (acc, row) => ({ ...acc, [row.account_id]: Number(row.total) }),
      {} as Record<number, number>,
    );
  }
}
