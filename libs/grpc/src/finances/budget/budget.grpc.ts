import { Observable } from 'rxjs';
import {
  Id,
  Budget,
  BudgetInput,
  Status,
  BudgetFilter,
  Movement,
} from '@admin-back/grpc';

export interface BudgetGrpc {
  findOne(id: Id): Observable<Budget>;

  findAll(filter: BudgetFilter): Observable<Budget[]>;

  findMovements(id: Id): Observable<Movement[]>;

  save(budget: BudgetInput): Observable<Budget>;

  remove(id: Id): Observable<Status>;
}
