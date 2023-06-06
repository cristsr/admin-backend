import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime, Interval } from 'luxon';
import { defer, map, Observable } from 'rxjs';
import { Repository } from 'typeorm';
import {
  Expense,
  Movements,
  ExpenseFilter,
  SummaryGrpc,
  Period,
  LastMovementFilter,
} from '@admin-back/grpc';
import { MovementEntity } from 'app/movement/entities';

@GrpcService('finances')
export class SummaryService implements SummaryGrpc {
  constructor(
    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

  @GrpcMethod()
  expenses(filter: ExpenseFilter): Observable<Expense[]> {
    const periodConfig: Record<Exclude<Period, 'all' | 'custom'>, any> = {
      daily: () => `m.date = '${DateTime.fromISO(filter.date).toISODate()}'`,

      weekly: () => {
        const interval = Interval.fromISO(filter.date);
        return `date BETWEEN '${interval.start.toISODate()}'::date AND '${interval.end.toISODate()}'::date`;
      },

      monthly: () => `to_char(m.date, 'YYYY-MM') = '${filter.date}'`,

      yearly: () => `to_char(date, 'YYYY') = '${filter.date}'`,
    };

    const where = periodConfig[filter.period]();

    return this.expensesQuery({ where });
  }

  @GrpcMethod()
  lastMovements(filter: LastMovementFilter): Observable<Movements> {
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
    ).pipe(map((data) => ({ data })));
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
          },
        }));
      })
    );
  }
}
