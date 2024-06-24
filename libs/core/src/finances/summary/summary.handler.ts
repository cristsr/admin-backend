import { Observable } from 'rxjs';
import {
  Balance,
  BalanceFilter,
  Expense,
  ExpenseFilter,
  LastMovementFilter,
  Movement,
} from '../..';

export interface SummaryHandler {
  balance(filter: BalanceFilter, ...args): Observable<Balance>;

  expenses(filter: ExpenseFilter, ...args): Observable<Expense[]>;

  lastMovements(filter: LastMovementFilter): Observable<Movement[]>;
}
