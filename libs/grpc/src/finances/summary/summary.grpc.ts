import { Observable } from 'rxjs';
import {
  Movements,
  ExpenseFilter,
  LastMovementFilter,
  Expense,
} from '@admin-back/grpc';

export interface SummaryGrpc {
  expenses(filter: ExpenseFilter): Observable<Expense[]>;

  lastMovements(filter: LastMovementFilter): Observable<Movements>;
}
