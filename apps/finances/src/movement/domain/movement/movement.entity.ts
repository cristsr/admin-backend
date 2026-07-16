import { PropertiesOnly } from '@shared';
import {
  MovementAccountSummary,
  MovementCategorySummary,
  MovementSubcategorySummary,
  MovementType,
} from './movement.types';

export class Movement {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  date: Date;

  type: MovementType;

  description: string;

  amount: number;

  currency: string;

  categoryId: number;

  category?: MovementCategorySummary;

  subcategoryId?: number;

  subcategory?: MovementSubcategorySummary;

  accountId: number;

  account?: MovementAccountSummary;

  externalReference?: string;

  user: number;

  private constructor(payload?: Partial<Movement>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Movement>): Movement {
    return new Movement(payload);
  }

  update(payload: Partial<PropertiesOnly<Movement>>): void {
    Object.assign(this, payload);
  }
}
