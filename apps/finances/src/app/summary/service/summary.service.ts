import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DateTime } from 'luxon';
import { Repository } from 'typeorm';
import {
  defer,
  forkJoin,
  from,
  map,
  Observable,
  of,
  reduce,
  switchMap,
  toArray,
} from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { Expense, Expenses, Movements, SummaryGrpc } from '@admin-back/grpc';
import { MovementEntity } from 'app/movement/entities';

@GrpcService('finances')
export class SummaryService implements SummaryGrpc {
  constructor(
    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

  @GrpcMethod()
  expenses(_, metadata: Metadata): Observable<Expenses> {
    const [isoDate] = <string[]>metadata.get('clientDate');
    const date = DateTime.fromISO(isoDate);
    const today = date.toSQLDate();
    const start = date.startOf('week').toSQLDate();
    const end = date.endOf('week').toSQLDate();
    const queries = [
      {
        period: 'day',
        query: `m.date = '${today}'`,
      },
      {
        period: 'week',
        query: `date BETWEEN '${start}'::date AND '${end}'::date`,
      },
      {
        period: 'month',
        query: `to_char(m.date, 'YYYY-MM') = to_char('${today}'::date, 'YYYY-MM')`,
      },
    ];

    const source$ = forkJoin(
      queries.map(({ period, query }) =>
        this.expensesQuery(query).pipe(
          map((data) => ({
            period,
            data,
          }))
        )
      )
    );

    return source$.pipe(
      map((data) =>
        data.reduce(
          (prev, { data, period }) => ((prev[period] = data), prev),
          <Expenses>{}
        )
      )
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
