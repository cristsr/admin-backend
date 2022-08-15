import { Category, Subcategory } from '@admin-back/grpc';
import { Observable } from 'rxjs';
import { Empty } from '../../types';

export interface MovementService {
  create(data: CreateMovement): Observable<Movement>;
  findOne(id: MovementId): Observable<Movement>;
  findAll(query: MovementQuery): Observable<Movement[]>;
  update(data: UpdateMovement): Observable<Movement>;
  remove(id: MovementId): Observable<Empty>;
  removeAll(empty: Empty): Observable<Empty>;
}

export interface Movement {
  id: number;
  date: string;
  type: MovementType;
  description: string;
  amount: number;
  category: Category;
  subcategory: Subcategory;
}

export interface CreateMovement
  extends Omit<Movement, 'id' | 'category' | 'subcategory'> {
  category: number;
  subcategory: number;
}

export interface UpdateMovement extends Partial<CreateMovement> {
  id: number;
}

export interface MovementId {
  id: number;
}

export interface MovementQuery {
  period: Period;
  date: string;
  category?: number;
  type?: MovementType;
}

export const movementTypes = ['income', 'expense'] as const;
export type MovementType = typeof movementTypes[number];

export const periods = ['day', 'week', 'month', 'year'] as const;
export type Period = typeof periods[number];
