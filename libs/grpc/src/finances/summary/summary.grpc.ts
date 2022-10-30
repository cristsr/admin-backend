import { Observable } from 'rxjs';
import { Empty, Expenses, Movements, ExpenseFilter } from '@admin-back/grpc';

export interface SummaryGrpc {
  expenses(filter: ExpenseFilter): Observable<Expenses>;

  lastMovements(empty: Empty): Observable<Movements>;
}
