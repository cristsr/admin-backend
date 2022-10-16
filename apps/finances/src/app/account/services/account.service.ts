import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { from, Observable } from 'rxjs';
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
import { fromAsync } from '@admin-back/shared';
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
    const account$ = this.accountRepository
      .find({ relations: ['balance'] })
      .then((data) => ({ data }));

    return from(account$);
  }

  @GrpcMethod()
  findOne({ id }: Id): Observable<Account> {
    const account$ = this.accountRepository.findOne({
      where: { id },
      relations: ['balance'],
    });

    return from(account$);
  }

  @GrpcMethod()
  findByUser(user: Id): Observable<Accounts> {
    const account$ = this.accountRepository
      .find({
        where: { user: user.id },
      })
      .then((data) => ({ data }));

    return from(account$);
  }

  @GrpcMethod()
  findBalance(query: QueryBalance): Observable<Balance> {
    return fromAsync(async () => {
      const balanceMap = {
        daily: () => ({
          query: "to_char(date, 'YYYY-MM-DD') <= :date",
          params: { date: query.date },
        }),

        weekly: () => {
          const interval = Interval.fromISO(query.date);

          return {
            query: "to_char(date, 'YYYY-MM-DD') <= :date",
            params: { date: interval.end.toSQLDate() },
          };
        },

        monthly: () => ({
          query: "to_char(date, 'YYYY-MM') <= :date",
          params: { date: query.date },
        }),

        yearly: () => ({
          query: "to_char(date, 'YYYY') <= :date",
          params: { date: query.date },
        }),
      };

      const movementMap = {
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

      const account = await this.accountRepository.findOne({
        where: {
          id: query.account,
        },
      });

      if (!account) {
        return null;
      }

      const balanceOpts = balanceMap[query.period]();
      const movementOpts = movementMap[query.period]();

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

      const balance = await movementQuery(balanceOpts).getRawOne();
      const report = await movementQuery(movementOpts).getRawOne();

      return {
        balance: account.initialBalance + balance.incomes - balance.expenses,
        incomes: report.incomes,
        expenses: report.expenses,
      };
    });
  }

  @GrpcMethod()
  create(data: CreateAccount): Observable<Account> {
    const account$ = this.accountRepository.save({
      name: data.name,
      user: data.user,
      initialBalance: data.initialBalance,
    });

    return from(account$);
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
