import { Observable } from 'rxjs';
import { Id, Status } from '../../shared';
import { Budget, BudgetFilter, BudgetInput, UserBudgetFilter } from '../budget';
import { Movement } from '../movement';

export abstract class BudgetHandler {
  abstract findOne(
    filter: UserBudgetFilter,
  ): Promise<Budget> | Observable<Budget>;

  abstract findAll(
    filter: BudgetFilter,
  ): Promise<Budget[]> | Observable<Budget[]>;

  abstract findMovements(id: Id): Promise<Movement[]> | Observable<Movement[]>;

  abstract save(budget: BudgetInput): Observable<Budget>;

  abstract remove(id: Id): Observable<Status>;
}
