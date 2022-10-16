import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { Empty, Expenses, Movements } from '@admin-back/grpc';

export interface SummaryGrpc {
  expenses(empty: Empty, metadata: Metadata): Observable<Expenses>;

  lastMovements(empty: Empty): Observable<Movements>;
}
