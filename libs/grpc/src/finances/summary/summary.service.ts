import { Observable } from 'rxjs';
import { Category, Movement } from '@admin-back/grpc';
import { Empty } from '../../types';

export interface SummaryService {
  balance(empty: Empty): Observable<Balance>;
  expenses(empty: Empty): Observable<Expenses>;
  lastMovements(empty: Empty): Observable<Movement[]>;
}

export interface Expense {
  amount: number;
  percentage: number;
  category: Category;
}

export interface Expenses {
  day: Expense[];
  week: Expense[];
  month: Expense[];
}

export interface Balance {
  balance: number;
  incomeMonth: number;
  expenseMonth: number;
  incomeYear: number;
  expenseYear: number;
}
