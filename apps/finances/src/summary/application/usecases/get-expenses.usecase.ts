import { Injectable } from '@nestjs/common';
import { Expense, SummaryRepository } from '../../domain/summary';
import { ExpenseFilterDto } from '../dto/expense-filter.dto';

@Injectable()
export class GetExpensesUsecase {
  constructor(private readonly summaryRepository: SummaryRepository) {}

  async execute(filter: ExpenseFilterDto, user: number): Promise<Expense[]> {
    return this.summaryRepository.expenses({ ...filter, user });
  }
}
