import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { defer, forkJoin, map, Observable } from 'rxjs';
import { Repository } from 'typeorm';
import {
  Account,
  AccountGrpc,
  Accounts,
  Balance,
  AccountInput,
  Id,
  BalanceFilter,
  Movement,
} from '@admin-back/grpc';
import { AccountEntity } from 'app/account/entities';
import { Interval } from 'luxon';
import { MovementEntity } from 'app/movement/entities';
import { OnEvent } from '@nestjs/event-emitter';
import { SaveMovement } from 'app/constants';

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
  findBalance(filter: BalanceFilter): Observable<Balance> {
    const balanceMap: Record<string, any> = {
      daily: () => ({
        query: "to_char(date, 'YYYY-MM-DD') <= :date",
        params: { date: filter.date },
      }),

      weekly: () => ({
        query: "to_char(date, 'YYYY-MM-DD') <= :date",
        params: { date: Interval.fromISO(filter.date).end.toSQLDate() },
      }),

      monthly: () => ({
        query: "to_char(date, 'YYYY-MM') <= :date",
        params: { date: filter.date },
      }),

      yearly: () => ({
        query: "to_char(date, 'YYYY') <= :date",
        params: { date: filter.date },
      }),
    };

    const movementMap: Record<string, any> = {
      daily: () => ({
        query: "to_char(date, 'YYYY-MM-DD') = :date",
        params: { date: filter.date },
      }),

      weekly: () => {
        const interval = Interval.fromISO(filter.date);

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
        params: { date: filter.date },
      }),

      yearly: () => ({
        query: "to_char(date, 'YYYY') = :date",
        params: { date: filter.date },
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
        .where('user_id = :user', { user: filter.user })
        .andWhere('account_id = :account', { account: filter.account })
        .andWhere(opts.query, opts.params);
    };

    const balanceOpts = balanceMap[filter.period]();
    const movementOpts = movementMap[filter.period]();

    const account = defer(() =>
      this.accountRepository.findOne({
        where: {
          id: filter.account,
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
  save(data: AccountInput): Observable<Account> {
    return defer(() =>
      this.accountRepository.save({
        name: data.name,
        user: data.user,
        initialBalance: data.initialBalance,
      })
    );
  }

  @OnEvent(SaveMovement)
  updateBalance(event: { previous?: Movement; current: Movement }): void {
    console.log('updateBalance called');
    const { previous, current } = event;
    const { account, amount, type } = current;

    const calculateBalance = () => {
      if (!previous) {
        return type === 'income'
          ? account.balance2 + amount
          : account.balance2 - amount;
      }

      const { type: prevType, amount: prevAmount } = previous;
      const diff = prevAmount - amount;

      console.log({ balance: account.balance2, amount, prevAmount, diff });

      if (prevType !== type) {
        // different types

        if (type === 'expense') {
          // from income to expense

          // e.g. balance $60.000
          // previous income $60000
          // current expense $70000
          // return $-70000

          // then return the new balance discount the previous amount and the current amount
          return account.balance2 - prevAmount - amount;
        }

        // from expense to income

        // e.g. balance $60000
        // previous expense $70000
        // current income $60000
        // return $70000

        // 60000 + 70000 + 60000 = 190000

        // then return the new balance adding the previous amount and adding the difference
        return account.balance2 + prevAmount + amount;
      }

      // equal types

      if (prevAmount === amount) {
        // no changes, so do nothing
        return account.balance2;
      }

      // amount are different between versions

      if (type === 'income') {
        // from income
        return (
          account.balance2 + (amount > prevAmount ? Math.abs(diff) : -diff)
        );
      }

      // from expense
      return account.balance2 + (amount > prevAmount ? -Math.abs(diff) : diff);
    };

    const balance = calculateBalance();

    console.log(balance);

    // update balance
    this.accountRepository
      .save({
        id: account.id,
        balance2: balance,
      })
      .then();
  }
}
