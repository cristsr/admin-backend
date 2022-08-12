import { Observable } from 'rxjs';
import { Category } from '@admin-back/grpc';

export interface BudgetService {
  create(): Observable<Budget>;
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
