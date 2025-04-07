import { Observable } from 'rxjs';
import {
  Balance,
  BalanceFilter,
  Expense,
  ExpenseFilter,
  LastMovementFilter,
  Movement,
} from '../..';

export abstract class SummaryHandler {
  abstract balance(filter: BalanceFilter, ...args): Observable<Balance>;

  abstract expenses(filter: ExpenseFilter, ...args): Observable<Expense[]>;

  abstract lastMovements(
    filter: LastMovementFilter,
  ): Promise<Movement[]> | Observable<Movement[]>;
}
