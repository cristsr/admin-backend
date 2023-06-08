import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { DateTime, Interval } from 'luxon';
import { defer, map, Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { Match } from '@admin-back/shared';
import {
  Expense,
  ExpenseFilter,
  SummaryGrpc,
  LastMovementFilter,
  Period,
  Movement,
  BalanceFilter,
  Balance,
} from '@admin-back/grpc';
import { MovementRepository } from 'app/movement/repositories';
import { AccountRepository } from 'app/account/repositories';
import { MovementEntity } from 'app/movement/entities';

@GrpcService('finances')
export class SummaryService implements SummaryGrpc {
  constructor(
    private movementRepository: MovementRepository,
    private accountRepository: AccountRepository,
    private dataSource: DataSource
  ) {}

  @GrpcMethod()
  balance(filter: BalanceFilter): Observable<Balance> {
    const parameters: Record<string, any> = {
      userId: filter.user,
      accountId: filter.account,
    };

    const periodMatch: Match<Period> = {
      DAILY: () => {
        const date = DateTime.fromISO(filter.date);
        parameters.startDate = date.startOf('day').toISO();
        parameters.endDate = date.endOf('day').toISO();
      },

      WEEKLY: () => {
        const { start, end } = Interval.fromISO(filter.date);
        parameters.startDate = start.startOf('day').toISO();
        parameters.endDate = end.endOf('day').toISO();
      },

      MONTHLY: () => {
        const date = DateTime.fromFormat(filter.date, 'yyyy-MM');
        parameters.startDate = date.startOf('month').toISO();
        parameters.endDate = date.endOf('month').toISO();
      },

      YEARLY: () => {
        const date = DateTime.fromFormat(filter.date, 'yyyy');
        parameters.startDate = date.startOf('year').toISO();
        parameters.endDate = date.endOf('year').toISO();
      },

      CUSTOM: () => {
        const { start, end } = Interval.fromISO(filter.date);
        parameters.startDate = start.startOf('day').toISO();
        parameters.endDate = end.endOf('day').toISO();
      },
    };

    periodMatch[filter.period]();

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
              `(SELECT initial_balance FROM accounts WHERE id = :accountId and user_id = :userId)::float AS initial_balance`,
              `COALESCE(SUM(CASE WHEN date <= :endDate THEN CASE WHEN type = 'INCOME' THEN amount ELSE -amount END END), 0)::float AS accumulated_balance`,
              `COALESCE(SUM(CASE WHEN type = 'INCOME' AND date >= :startDate AND date <= :endDate THEN amount END), 0)::float AS incomes`,
              `COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND date >= :startDate AND date <= :endDate THEN amount END), 0)::float AS expenses`,
            ])
            .from(MovementEntity, 'm')
            .where('user_id = :userId')
            .setParameters(parameters),
        'result'
      );

    return defer(() => query.getRawOne<Balance>());
  }

  @GrpcMethod()
  expenses(filter: ExpenseFilter): Observable<Expense[]> {
    const periodConfig: Match<Period> = {
      DAILY: () => `m.date = '${DateTime.fromISO(filter.date).toISODate()}'`,

      WEEKLY: () => {
        const { start, end } = Interval.fromISO(filter.date);
        return `date BETWEEN '${start.toISODate()}'::date AND '${end.toISODate()}'::date`;
      },

      MONTHLY: () => `to_char(m.date, 'YYYY-MM') = '${filter.date}'`,

      YEARLY: () => `to_char(date, 'YYYY') = '${filter.date}'`,

      CUSTOM: () => {
        const { start, end } = Interval.fromISO(filter.date);
        return `date BETWEEN '${start.toISODate()}'::date AND '${end.toISODate()}'::date`;
      },
    };

    const where = periodConfig[filter.period]();

    return this.expensesQuery({ where });
  }

  @GrpcMethod()
  lastMovements(filter: LastMovementFilter): Observable<Movement[]> {
    return defer(() =>
      this.movementRepository.find({
        relations: ['category', 'subcategory'],
        where: {
          account: {
            id: filter.account,
          },
          user: filter.user,
        },
        order: {
          date: 'DESC',
        },
        take: 5,
      })
    );
  }

  private expensesQuery(opts): Observable<Expense[]> {
    const query = this.movementRepository
      .createQueryBuilder('m')
      .select('SUM(m.amount)::float', 'amount')
      .leftJoinAndSelect('m.category', 'c')
      .where(opts.where)
      .andWhere(`m.type = 'expense'`)
      .groupBy('c.id, c.name, c.color, c.icon')
      .orderBy('amount', 'DESC')
      .limit(5);

    return defer(() => query.getRawMany<Record<string, any>>()).pipe(
      map((data) => {
        const total = data.reduce((acc, { amount }) => acc + amount, 0);

        return data.map((item) => ({
          amount: item.amount,
          percentage: Math.round((item.amount / total) * 100),
          category: {
            id: item.c_id,
            name: item.c_name,
            color: item.c_color,
            icon: item.c_icon,
            createdAt: item.c_created_at,
            updatedAt: item.c_updated_at,
            deletedAt: item.c_deleted_at,
          },
        }));
      })
    );
  }
}
