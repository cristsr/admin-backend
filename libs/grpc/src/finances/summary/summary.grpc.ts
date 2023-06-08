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
  balance(filter: BalanceFilter): Observable<Balance>;

  expenses(filter: ExpenseFilter): Observable<Expense[]>;

  lastMovements(filter: LastMovementFilter): Observable<Movement[]>;
}
