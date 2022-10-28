import { Observable } from 'rxjs';
import {
  Id,
  Budget,
  Budgets,
  BudgetInput,
  Movements,
  Status,
  BudgetFilter,
} from '@admin-back/grpc';

export interface BudgetGrpc {
  findOne(id: Id): Observable<Budget>;

  findAll(filters: BudgetFilter): Observable<Budgets>;

  findMovements(id: Id): Observable<Movements>;

  save(budget: BudgetInput): Observable<Budget>;

  remove(id: Id): Observable<Status>;
}
