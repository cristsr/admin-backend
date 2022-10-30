import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import { defer, map, Observable } from 'rxjs';
import { Repository } from 'typeorm';
import {
  Expense,
  Expenses,
  Movements,
  ExpenseFilter,
  SummaryGrpc,
  Period,
} from '@admin-back/grpc';
import { MovementEntity } from 'app/movement/entities';

@GrpcService('finances')
export class SummaryService implements SummaryGrpc {
  constructor(
    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

  @GrpcMethod()
  expenses(filter: ExpenseFilter): Observable<Expenses> {
    const date = DateTime.utc();
    const today = date.toSQLDate();
    const start = date.startOf('week').toSQLDate();
    const end = date.endOf('week').toSQLDate();

    const queriesMap: Record<Exclude<Period, 'all' | 'custom'>, any> = {
      daily: () => ({
        query: `m.date = '${today}'`,
        params: { today },
      }),

      weekly: () => ({
        query: `date BETWEEN '${start}'::date AND '${end}'::date`,
        params: {},
      }),

      monthly: () => ({
        query: `to_char(m.date, 'YYYY-MM') = to_char('${today}'::date, 'YYYY-MM')`,
        params: {},
      }),

      yearly: () => ({
        query: "to_char(date, 'YYYY') = :date",
        params: { date: filter.date },
      }),
    };

    return this.expensesQuery(queriesMap[filter.period]().query).pipe(
      map((data) => ({ data }))
    );
  }

  @GrpcMethod()
  lastMovements(): Observable<Movements> {
    return defer(() =>
      this.movementRepository.find({
        relations: ['category', 'subcategory'],
        order: {
          date: 'DESC',
        },
        take: 5,
      })
    ).pipe(map((data) => ({ data })));
  }

  private expensesQuery(where: string): Observable<Expense[]> {
    const query = this.movementRepository
      .createQueryBuilder('m')
      .select('SUM(m.amount)::float', 'amount')
      .leftJoinAndSelect('m.category', 'c')
      .where(where)
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
