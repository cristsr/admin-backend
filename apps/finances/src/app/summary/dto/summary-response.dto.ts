import { IsNumber } from 'class-validator';

export class SummaryDto {
  @IsNumber()
  totalBalance: number;

  @IsNumber()
  income: number;

  @IsNumber()
  expense: number;
}

export class ExpenseDto {
  @IsNumber()
  amount: number;

  @IsNumber()
  percentage: number;

  category: any;
}

export class ExpensesDto {
  day: ExpenseDto[];

  week: ExpenseDto[];

  month: ExpenseDto[];
}
