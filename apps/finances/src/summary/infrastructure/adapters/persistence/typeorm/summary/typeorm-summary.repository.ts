import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Nullable } from '@shared';
import { DataSource, In, Repository } from 'typeorm';
import { TypeOrmCategoryEntity } from '../../../../../../category/infrastructure/adapters/persistence/typeorm/category';
import { Movement, MovementType } from '../../../../../../movement/domain/movement';
import {
  TypeOrmMovementEntity,
  TypeOrmMovementMapper,
} from '../../../../../../movement/infrastructure/adapters/persistence/typeorm/movement';
import {
  Balance,
  BalanceQuery,
  Expense,
  ExpenseQuery,
  LastMovementsQuery,
  SummaryRepository,
} from '../../../../../domain/summary';

@Injectable()
export class TypeOrmSummaryRepository implements SummaryRepository {
  constructor(
    @InjectRepository(TypeOrmMovementEntity)
    private readonly movementRepository: Repository<TypeOrmMovementEntity>,
    @InjectRepository(TypeOrmCategoryEntity)
    private readonly categoryRepository: Repository<TypeOrmCategoryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async balance(filter: BalanceQuery): Promise<Nullable<Balance>> {
    const query = this.dataSource
      .createQueryBuilder()
      .select([
        'incomes',
        'expenses',
        'initial_balance + accumulated_balance AS balance',
      ])
      .from(
        (qb) =>
          qb
            .select([
              `COALESCE((SELECT initial_balance FROM accounts WHERE id = :accountId and user_id = :userId), 0) AS initial_balance`,
              // Transfers move this account's balance (IN adds, OUT subtracts)
              // but are left out of incomes/expenses: moving your own money
              // between accounts is neither earning nor spending.
              `COALESCE(SUM(CASE WHEN date <= :endDate THEN CASE WHEN type IN ('INCOME', 'TRANSFER_IN') THEN amount ELSE -amount END END), 0) AS accumulated_balance`,
              `COALESCE(SUM(CASE WHEN type = 'INCOME' AND date BETWEEN :startDate and :endDate THEN amount END), 0) AS incomes`,
              `COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND date BETWEEN :startDate and :endDate THEN amount END), 0) AS expenses`,
            ])
            .from(TypeOrmMovementEntity, 'm')
            .where('user_id = :userId')
            // Without this the sums covered every account the user owns while
            // initial_balance came from just one, so the balance mixed them.
            .andWhere('account_id = :accountId')
            .andWhere('deleted_at IS NULL')
            .setParameters({
              userId: filter.user,
              accountId: filter.account,
              startDate: filter.startDate,
              endDate: filter.endDate,
            }),
        'result',
      );

    // numeric comes back from the driver as string, so it is mapped
    // explicitly — the aggregation itself stays exact inside Postgres.
    const raw = await query.getRawOne<{
      incomes: string;
      expenses: string;
      balance: string;
    }>();

    if (!raw) return null;

    return {
      incomes: Number(raw.incomes),
      expenses: Number(raw.expenses),
      balance: Number(raw.balance),
    };
  }

  async expenses(filter: ExpenseQuery): Promise<Expense[]> {
    const data = await this.movementRepository
      .createQueryBuilder('m')
      .select(['SUM(m.amount) AS amount', 'm.category_id AS "categoryId"'])
      .where(`date BETWEEN :startDate AND :endDate`)
      .andWhere(`m.type = :type`)
      .andWhere(`m.user_id = :userId`)
      .andWhere(`m.deleted_at IS NULL`)
      .andWhere(`m.account_id = :accountId`)
      .groupBy('m.category_id')
      .orderBy('amount', 'DESC')
      .setParameters({
        startDate: filter.startDate,
        endDate: filter.endDate,
        type: MovementType.EXPENSE,
        userId: filter.user,
        accountId: filter.account,
      })
      .limit(5)
      .getRawMany<{ amount: string; categoryId: number }>()
      .then((rows) =>
        rows.map((row) => ({ ...row, amount: Number(row.amount) })),
      );

    if (!data.length) {
      return [];
    }

    const categories = await this.categoryRepository.findBy({
      id: In(data.map((item) => item.categoryId)),
    });

    const total = data.reduce((acc, { amount }) => acc + amount, 0);

    return data.map((item) => {
      const category = categories.find((c) => c.id === item.categoryId);

      return {
        amount: item.amount,
        percentage: Math.round((item.amount / total) * 100),
        category: category && {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
        },
      };
    });
  }

  async lastMovements(filter: LastMovementsQuery): Promise<Movement[]> {
    const entities = await this.movementRepository.find({
      relations: ['category', 'subcategory'],
      where: {
        account: { id: filter.account },
        user: filter.user,
      },
      order: {
        date: 'DESC',
      },
      take: 5,
    });

    return entities.map(TypeOrmMovementMapper.toDomain);
  }
}
