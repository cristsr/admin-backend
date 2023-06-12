import { Observable } from 'rxjs';
import {
  ExpenseFilter,
  LastMovementFilter,
  Expense,
  Movement,
  BalanceFilter,
  Balance,
} from '../..';

export interface SummaryGrpc {
  balance(filter: BalanceFilter, ...args): Observable<Balance>;

  expenses(filter: ExpenseFilter, ...args): Observable<Expense[]>;

  lastMovements(filter: LastMovementFilter): Observable<Movement[]>;
}
