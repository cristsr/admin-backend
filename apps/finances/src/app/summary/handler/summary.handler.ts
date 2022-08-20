import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Balance, Expense, Expenses, Movements } from '@admin-back/grpc';
import { MovementEntity } from 'app/movement/entities';
import { BalanceEntity, SummaryEntity } from 'app/summary/entities';

@Injectable()
export class SummaryHandler {
  #logger = new Logger(SummaryHandler.name);

  constructor(
    @InjectRepository(BalanceEntity)
    private balanceRepository: Repository<BalanceEntity>,

    @InjectRepository(SummaryEntity)
    private summaryRepository: Repository<SummaryEntity>,

    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

  balance(): Promise<Balance> {
    return this.balanceRepository.findOne({});
  }

  async expenses(date: DateTime): Promise<Expenses> {
    let where: string;

    const today = date.toSQLDate();
    const start = date.startOf('week').toSQLDate();
    const end = date.endOf('week').toSQLDate();

    where = `m.date = '${today}'`;
    const day = await this.expensesQuery(where);

    where = `date BETWEEN '${start}'::date AND '${end}'::date`;
    const week = await this.expensesQuery(where);

    where = `to_char(m.date, 'YYYY-MM') = to_char('${today}'::date, 'YYYY-MM')`;
    const month = await this.expensesQuery(where);

    return {
      day,
      week,
      month,
    };
  }

  lastMovements(): Promise<Movements> {
    return this.movementRepository
      .find({
        relations: ['category', 'subcategory'],
        order: {
          date: 'DESC',
        },
        take: 5,
      })
      .then((data) => ({ data }));
  }

  private expensesQuery(where: string): Promise<Expense[]> {
    const query = this.movementRepository
      .createQueryBuilder('m')
      .select('SUM(m.amount)::float', 'amount')
      .innerJoinAndSelect('m.category', 'c')
      .where(where)
      .andWhere(`m.type = 'expense'`)
      .groupBy('c.id, c.name, c.color, c.icon')
      .orderBy('amount', 'DESC')
      .limit(5);

    return query.getRawMany().then((data) => {
      const total = data.reduce((acc, cur) => acc + cur.amount, 0);

      return data.map<Expense>((item) => ({
        amount: item.amount,
        percentage: Math.round((item.amount / total) * 100),
        category: {
          id: item.c_id,
          name: item.c_name,
          color: item.c_color,
          icon: item.c_icon,
        },
      }));
    });
  }

  // TODO: review this method or delete it
  async generateExpensesByWeek(): Promise<any> {
    const today = DateTime.local();

    const days = new Array(7).fill(0).map((_, i: number) => ({
      locale: today.minus({ days: i }).toLocaleString({ weekday: 'short' }),
      format: today.minus({ days: i }).toFormat('yyyy-MM-dd'),
    }));

    const result = [];

    for (const day of days) {
      const query = this.summaryRepository
        .createQueryBuilder()
        .select('cast(SUM(amount) as real)', 'amount')
        .where(`date = :date`, { date: day.format });

      try {
        const record = await query.getRawOne();

        result.push({
          day: day.locale,
          amount: record?.amount ?? 0,
        });
      } catch (e) {
        this.#logger.error(`Error generating bar stats: ${e.message}`);

        result.push({
          day: day.locale,
          amount: 0,
        });
      }
    }

    return result;
  }
}
