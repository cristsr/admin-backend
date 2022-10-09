import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from 'luxon';
import { Balance, QueryBalance } from '@admin-back/grpc';
import { AccountEntity } from 'app/account/entities';
import { MovementEntity } from 'app/movement/entities';

export class BalanceHandler {
  constructor(
    @InjectRepository(AccountEntity)
    private accountRepository: Repository<AccountEntity>,

    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

  async findBalance(query: QueryBalance): Promise<Balance> {
    const balanceMap = {
      daily: () => ({
        query: "to_char(date, 'YYYY-MM-DD') <= :date",
        params: {
          date: query.date,
        },
      }),

      weekly: () => {
        const interval = Interval.fromISO(query.date);

        return {
          query: "to_char(date, 'YYYY-MM-DD') <= :date",
          params: {
            date: interval.end.toSQLDate(),
          },
        };
      },

      monthly: () => ({
        query: "to_char(date, 'YYYY-MM') <= :date",
        params: {
          date: query.date,
        },
      }),

      yearly: () => ({
        query: "to_char(date, 'YYYY') <= :date",
        params: {
          date: query.date,
        },
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
          query:
            "to_char(date, 'YYYY-MM-DD') >= :start and to_char(date, 'YYYY-MM-DD') <= :end",
          params: {
            start: interval.start.toSQLDate(),
            end: interval.end.toSQLDate(),
          },
        };
      },

      monthly: () => ({
        query: "to_char(date, 'YYYY-MM') = :date",
        params: {
          date: query.date,
        },
      }),

      yearly: () => ({
        query: "to_char(date, 'YYYY') = :date",
        params: {
          date: query.date,
        },
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
      expenses: report.expenses,
      incomes: report.incomes,
    };
  }
}
