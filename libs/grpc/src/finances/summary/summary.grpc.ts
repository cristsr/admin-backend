import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { Empty, Balances, Expenses, Movements } from '@admin-back/grpc';

export interface SummaryGrpc {
  balance(empty: Empty): Observable<Balances>;

  expenses(empty: Empty, metadata: Metadata): Observable<Expenses>;

  lastMovements(empty: Empty): Observable<Movements>;
}
