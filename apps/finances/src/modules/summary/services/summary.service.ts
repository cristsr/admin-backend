import { Injectable } from '@nestjs/common';
import {
  Balance,
  BalanceFilter,
  Expense,
  ExpenseFilter,
  LastMovementFilter,
  Movement,
  MovementType,
  SummaryHandler,
} from '@core';
import { Observable, catchError, defer, map, of, switchMap } from 'rxjs';
import { DataSource, In } from 'typeorm';
import { CategoryRepository } from 'app/modules/category/repositories';
import { MovementEntity } from 'app/modules/movement/entities';
import { MovementRepository } from 'app/modules/movement/repositories';

@Injectable()
export class SummaryService implements SummaryHandler {
  constructor(
    private movementRepository: MovementRepository,
    private categoryRepository: CategoryRepository,
    private dataSource: DataSource,
  ) {}

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
              `COALESCE((SELECT initial_balance FROM accounts WHERE id = :accountId and user_id = :userId)::float, 0) AS initial_balance`,
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
        'result',
      );

    return defer(() => query.getRawOne<Balance>()).pipe(
      catchError(() => of(null)),
    );
  }

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
          }),
        );

        return categories.pipe(
          map((categories) => {
            const total = data.reduce((acc, { amount }) => acc + amount, 0);

            return data.map((item) => ({
              amount: item.amount,
              percentage: Math.round((item.amount / total) * 100),
              category: categories.find((c) => c.id === item.categoryId),
            }));
          }),
        );
      }),
    );
  }

  async lastMovements(filter: LastMovementFilter): Promise<Movement[]> {
    return this.movementRepository.find({
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
    });
  }
}
