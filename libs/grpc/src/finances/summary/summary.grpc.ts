import { Observable } from 'rxjs';
import {
  Expenses,
  Movements,
  ExpenseFilter,
  LastMovementFilter,
} from '@admin-back/grpc';

export interface SummaryGrpc {
  expenses(filter: ExpenseFilter): Observable<Expenses>;

  lastMovements(filter: LastMovementFilter): Observable<Movements>;
}
