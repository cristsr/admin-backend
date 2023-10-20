import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { catchError, defer, map, Observable, of, switchMap } from 'rxjs';
import { DataSource, In } from 'typeorm';
import {
  Expense,
  ExpenseFilter,
  SummaryGrpc,
  LastMovementFilter,
  Movement,
  BalanceFilter,
  Balance,
  MovementType,
} from '@admin-back/grpc';
import { MovementRepository } from 'app/movement/repositories';
import { AccountRepository } from 'app/account/repositories';
import { MovementEntity } from 'app/movement/entities';
import { CategoryRepository } from 'app/category/repositories';

@GrpcService('finances')
export class SummaryService implements SummaryGrpc {
  constructor(
    private movementRepository: MovementRepository,
    private categoryRepository: CategoryRepository,
    private accountRepository: AccountRepository,
    private dataSource: DataSource
  ) {}

  @GrpcMethod()
  balance(filter: BalanceFilter): Observable<Balance> {
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
              `COALESCE(SUM(CASE WHEN type = 'INCOME' AND date BETWEEN :startDate and :endDate THEN amount END), 0)::float AS incomes`,
              `COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND date BETWEEN :startDate and :endDate THEN amount END), 0)::float AS expenses`,
            ])
            .from(MovementEntity, 'm')
            .where('user_id = :userId')
            .andWhere('active = :active')
            .setParameters({
              userId: filter.user,
              accountId: filter.account,
              startDate: filter.startDate,
              endDate: filter.endDate,
              active: true,
            }),
        'result'
      );

    return defer(() => query.getRawOne<Balance>()).pipe(
      catchError(() => of(null))
    );
  }

  @GrpcMethod()
  expenses(filter: ExpenseFilter): Observable<Expense[]> {
    const query = this.movementRepository
      .createQueryBuilder('m')
      .select([
        'SUM(m.amount)::float AS amount',
        'm.category_id AS "categoryId"',
      ])
      .where(`date BETWEEN :startDate AND :endDate`)
      .andWhere(`m.type = :type`)
      .andWhere(`m.user_id = :userId`)
      .andWhere(`m.active = :active`)
      .andWhere(`m.account_id = :accountId`)
      .groupBy('m.category_id')
      .orderBy('amount', 'DESC')
      .setParameters({
        startDate: filter.startDate,
        endDate: filter.endDate,
        type: MovementType.EXPENSE,
        userId: filter.user,
        active: true,
        accountId: filter.account,
      })
      .limit(5);

    return defer(() => query.getRawMany<Record<string, any>>()).pipe(
      switchMap((data) => {
        if (!data.length) {
          return of([]);
        }

        const categories = defer(() =>
          this.categoryRepository.findBy({
            id: In(data.map((item) => item.categoryId)),
          })
        );

        return categories.pipe(
          map((categories) => {
            const total = data.reduce((acc, { amount }) => acc + amount, 0);

            return data.map((item) => ({
              amount: item.amount,
              percentage: Math.round((item.amount / total) * 100),
              category: categories.find((c) => c.id === item.categoryId),
            }));
          })
        );
      })
    );
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
          active: true,
        },
        order: {
          date: 'DESC',
        },
        take: 5,
      })
    );
  }
}
