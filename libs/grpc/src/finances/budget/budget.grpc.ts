import { Observable } from 'rxjs';
import { Id, Status } from '../../shared';
import { Budget, BudgetFilter, BudgetInput } from '../budget';
import { Movement } from '../movement';

export interface BudgetGrpc {
  findOne(id: Id): Observable<Budget>;

  findAll(filter: BudgetFilter): Observable<Budget[]>;

  findMovements(id: Id): Observable<Movement[]>;

  save(budget: BudgetInput): Observable<Budget>;

  remove(id: Id): Observable<Status>;
}
