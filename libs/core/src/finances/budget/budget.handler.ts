import { Observable } from 'rxjs';
import { Id, Status } from '../../shared';
import { Budget, BudgetFilter, BudgetInput } from '../budget';
import { Movement } from '../movement';

export abstract class BudgetHandler {
  abstract findOne(id: Id): Observable<Budget>;

  abstract findAll(filter: BudgetFilter): Observable<Budget[]>;

  abstract findMovements(id: Id): Observable<Movement[]>;

  abstract save(budget: BudgetInput): Observable<Budget>;

  abstract remove(id: Id): Observable<Status>;
}
