import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '../../../shared-kernel/application/query/query-handler';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { ListExpensesQuery } from '../queries/list-expenses.query';
import { ExpenseReportDto, ExpenseLineItemDto } from '../dto/expense-report.dto';
import Big from 'big.js';

@Injectable()
@QueryHandler(ListExpensesQuery)
export class ListExpensesHandler implements IQueryHandler<ListExpensesQuery, ExpenseReportDto> {
  constructor(private readonly readModelStore: ReadModelStore) {}

  async handle(query: ListExpensesQuery): Promise<ExpenseReportDto> {
    const expenseRows = await this.readModelStore.query<any>(
      `SELECT t.id, t.date, t.description, t.category, t.amount, t.currency
       FROM proj_transactions t
       WHERE t.user_id = $1 AND t.date >= $2 AND t.date <= $3 AND t.type = 'EXPENSE'
       ORDER BY t.date DESC`,
      [query.userId, query.startDate, query.endDate],
    );

    const items = expenseRows.map(
      row =>
        new ExpenseLineItemDto(
          new Date(row.date),
          row.description,
          row.category || 'Uncategorized',
          row.amount,
          row.currency,
        ),
    );

    const totalByCategory: Record<string, string> = {};
    for (const item of items) {
      const current = totalByCategory[item.category] || '0';
      totalByCategory[item.category] = new Big(current)
        .plus(new Big(item.amount))
        .toFixed(2);
    }

    return new ExpenseReportDto(items, totalByCategory, 'USD');
  }
}
