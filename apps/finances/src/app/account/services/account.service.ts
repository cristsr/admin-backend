import { GrpcMethod, GrpcService } from '@nestjs/microservices';
import { defer, forkJoin, map, Observable } from 'rxjs';
import {
  Account,
  AccountGrpc,
  AccountInput,
  Balance,
  BalanceFilter,
  Id,
  Movement,
  MovementType,
  Period,
} from '@admin-back/grpc';
import { Interval } from 'luxon';
import { OnEvent } from '@nestjs/event-emitter';
import { SaveMovement } from 'app/constants';
import { AccountRepository } from 'app/account/repositories';
import { MovementRepository } from 'app/movement/repositories';
import { Match } from '@admin-back/shared';

@GrpcService('finances')
export class AccountService implements AccountGrpc {
  constructor(
    private accountRepository: AccountRepository,
    private movementRepository: MovementRepository
  ) {}

  @GrpcMethod()
  findAll(): Observable<Account[]> {
    return defer(() => this.accountRepository.find());
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
  findByUser(user: Id): Observable<Account[]> {
    return defer(() =>
      this.accountRepository.find({
        where: {
          user: user.id,
        },
      })
    );
  }

  @GrpcMethod()
  findBalance(filter: BalanceFilter): Observable<Balance> {
    const balanceMatch: Match<Period> = {
      DAILY: () => ({
        query: "to_char(date, 'YYYY-MM-DD') <= :date",
        params: { date: filter.date },
      }),

      WEEKLY: () => ({
        query: "to_char(date, 'YYYY-MM-DD') <= :date",
        params: { date: Interval.fromISO(filter.date).end.toSQLDate() },
      }),

      MONTHLY: () => ({
        query: "to_char(date, 'YYYY-MM') <= :date",
        params: { date: filter.date },
      }),

      YEARLY: () => ({
        query: "to_char(date, 'YYYY') <= :date",
        params: { date: filter.date },
      }),

      CUSTOM: () => ({}),
    };

    const movementMatch: Match<Period> = {
      DAILY: () => ({
        query: "to_char(date, 'YYYY-MM-DD') = :date",
        params: { date: filter.date },
      }),

      WEEKLY: () => {
        const { start, end } = Interval.fromISO(filter.date);

        return {
          query: `to_char(date, 'YYYY-MM-DD') >= :start and to_char(date, 'YYYY-MM-DD') <= :end`,
          params: {
            start: start.toSQLDate(),
            end: end.toSQLDate(),
          },
        };
      },

      MONTHLY: () => ({
        query: "to_char(date, 'YYYY-MM') = :date",
        params: { date: filter.date },
      }),

      YEARLY: () => ({
        query: "to_char(date, 'YYYY') = :date",
        params: { date: filter.date },
      }),

      CUSTOM: () => {
        const { start, end } = Interval.fromISO(filter.date);

        return {
          query: `to_char(date, 'YYYY-MM-DD') >= :start and to_char(date, 'YYYY-MM-DD') <= :end`,
          params: {
            start: start.toSQLDate(),
            end: end.toSQLDate(),
          },
        };
      },
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

    const balanceOpts = balanceMatch[filter.period]();
    const movementOpts = movementMatch[filter.period]();

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
    const { previous, current } = event;
    const { account, amount, type } = current;

    const calculateBalance = () => {
      if (!previous) {
        return type === MovementType.INCOME
          ? account.balance2 + amount
          : account.balance2 - amount;
      }

      const { type: prevType, amount: prevAmount } = previous;
      const diff = prevAmount - amount;

      if (prevType !== type) {
        // different types

        if (type === MovementType.EXPENSE) {
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

      if (type === MovementType.INCOME) {
        // from income
        return (
          account.balance2 + (amount > prevAmount ? Math.abs(diff) : -diff)
        );
      }

      // from expense
      return account.balance2 + (amount > prevAmount ? -Math.abs(diff) : diff);
    };

    const balance = calculateBalance();

    // update balance
    this.accountRepository
      .save({
        id: account.id,
        balance2: balance,
      })
      .then();
  }
}
