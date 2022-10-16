import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { Expense, Expenses, Movements } from '@admin-back/grpc';
import { MovementEntity } from 'app/movement/entities';
import { SummaryEntity } from 'app/summary/entities';

@Injectable()
export class SummaryHandler {
  #logger = new Logger(SummaryHandler.name);

  constructor(
    @InjectRepository(SummaryEntity)
    private summaryRepository: Repository<SummaryEntity>,

    @InjectRepository(MovementEntity)
    private movementRepository: Repository<MovementEntity>
  ) {}

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

  private async expensesQuery(where: string): Promise<Expense[]> {
    const query = this.movementRepository
      .createQueryBuilder('m')
      .select('SUM(m.amount)::float', 'amount')
      .innerJoinAndSelect('m.category', 'c')
      .where(where)
      .andWhere(`m.type = 'expense'`)
      .groupBy('c.id, c.name, c.color, c.icon')
      .orderBy('amount', 'DESC')
      .limit(5);

    const data = await query.getRawMany();

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
  }
}
