import { Observable } from 'rxjs';
import { Category, Movement } from '@admin-back/grpc';
import { Empty } from '../../types';

export interface BudgetDefinition {
  create(): Observable<Budget>;
  findAll(): Observable<Budget[]>;
  findOne(id: BudgetId): Observable<Budget>;
  update(budget: UpdateBudget): Observable<Budget>;
  remove(id: BudgetId): Observable<Empty>;
  getBudgetMovements(id: BudgetId): Observable<Movement[]>;
}

export interface Budget {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  amount: number;
  spent: number;
  repeat: boolean;
  active: boolean;
  percentage: number;
  category: Category;
}

export interface CreateBudget {
  name: string;
  amount: number;
  category: number;
  repeat: boolean;
}

export interface UpdateBudget extends Partial<CreateBudget> {
  id: number;
}

export interface BudgetId {
  id: number;
}
