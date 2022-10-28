import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { defer, forkJoin, from, map, Observable } from 'rxjs';
import { Repository } from 'typeorm';
import {
  Account,
  AccountGrpc,
  Accounts,
  Balance,
  CreateAccount,
  Empty,
  Id,
  QueryBalance,
  Status,
} from '@admin-back/grpc';
import { AccountEntity } from 'app/account/entities';
import { Interval } from 'luxon';
import { MovementEntity } from 'app/movement/entities';

@GrpcService('finances')
export class AccountService implements AccountGrpc {
  constructor(
    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>,

    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

  @GrpcMethod()
  findAll(): Observable<Accounts> {
    return defer(() => this.accountRepository.find()).pipe(
      map((data) => ({
        data,
      }))
    );
  }

  @GrpcMethod()
  findOne({ id }: Id): Observable<Account> {
    return defer(() =>
      this.accountRepository.findOne({
        where: {
          id,
        },
      })
    );
  }

  @GrpcMethod()
  findByUser(user: Id): Observable<Accounts> {
    const account = defer(() =>
      this.accountRepository.find({
        where: {
          user: user.id,
        },
      })
    );

    return account.pipe(map((data) => ({ data })));
  }

  @GrpcMethod()
  findBalance(query: QueryBalance): Observable<Balance> {
    const balanceMap: Record<string, any> = {
      daily: () => ({
        query: "to_char(date, 'YYYY-MM-DD') <= :date",
        params: { date: query.date },
      }),

      weekly: () => ({
        query: "to_char(date, 'YYYY-MM-DD') <= :date",
        params: { date: Interval.fromISO(query.date).end.toSQLDate() },
      }),

      monthly: () => ({
        query: "to_char(date, 'YYYY-MM') <= :date",
        params: { date: query.date },
      }),

      yearly: () => ({
        query: "to_char(date, 'YYYY') <= :date",
        params: { date: query.date },
      }),
    };

    const movementMap: Record<string, any> = {
      daily: () => ({
        query: "to_char(date, 'YYYY-MM-DD') = :date",
        params: { date: query.date },
      }),

      weekly: () => {
        const interval = Interval.fromISO(query.date);

        return {
          query: `to_char(date, 'YYYY-MM-DD') >= :start and to_char(date, 'YYYY-MM-DD') <= :end`,
          params: {
            start: interval.start.toSQLDate(),
            end: interval.end.toSQLDate(),
          },
        };
      },

      monthly: () => ({
        query: "to_char(date, 'YYYY-MM') = :date",
        params: { date: query.date },
      }),

      yearly: () => ({
        query: "to_char(date, 'YYYY') = :date",
        params: { date: query.date },
      }),
    };

    // Reuse function
    const movementQuery = (opts) => {
      return this.movementRepository
        .createQueryBuilder()
        .select([
          "coalesce(sum(case when type = 'income'  then amount end)::real, 0) incomes",
          "coalesce(sum(case when type = 'expense' then amount end)::real, 0) expenses",
        ])
        .where('user_id = :user', { user: query.user })
        .andWhere('account_id = :account', { account: query.account })
        .andWhere(opts.query, opts.params);
    };

    const balanceOpts = balanceMap[query.period]();
    const movementOpts = movementMap[query.period]();

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: query.account,
        },
      })
    );

    const source$ = forkJoin({
      account,
      balance: movementQuery(balanceOpts).getRawOne(),
      report: movementQuery(movementOpts).getRawOne(),
    });

    return source$.pipe(
      map(({ account, balance, report }) => {
        if (!account) return null;

        return {
          balance: account.initialBalance + balance.incomes - balance.expenses,
          incomes: report.incomes,
          expenses: report.expenses,
        };
      })
    );
  }

  @GrpcMethod()
  create(data: CreateAccount): Observable<Account> {
    return defer(() =>
      this.accountRepository.save({
        name: data.name,
        user: data.user,
        initialBalance: data.initialBalance,
      })
    );
  }

  @GrpcMethod()
  update(empty: Empty): Observable<Account> {
    return undefined;
  }

  @GrpcMethod()
  remove(empty: Empty): Observable<Status> {
    return undefined;
  }
}
