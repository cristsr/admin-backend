import { Observable } from 'rxjs';
import {
  Id,
  Budget,
  Budgets,
  CreateBudget,
  UpdateBudget,
  Movements,
  Status,
  BudgetFilter,
} from '@admin-back/grpc';

export interface BudgetGrpc {
  findOne(id: Id): Observable<Budget>;

  findAll(filters: BudgetFilter): Observable<Budgets>;

  findMovements(id: Id): Observable<Movements>;

  create(budget: CreateBudget): Observable<Budget>;

  update(budget: UpdateBudget): Observable<Budget>;

  remove(id: Id): Observable<Status>;
}
