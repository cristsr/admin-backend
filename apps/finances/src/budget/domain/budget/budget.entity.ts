import { PropertiesOnly } from '@shared';
import { Period } from './period.enum';

export class Budget {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  amount: number;

  currency: string;

  startDate: Date;

  endDate: Date;

  repeat: boolean;

  period: Period;

  categoryId: number;

  accountId: number;

  user: number;

  spent?: number;

  percentage?: number;

  private constructor(payload?: Partial<Budget>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Budget>): Budget {
    return new Budget(payload);
  }

  update(payload: Partial<PropertiesOnly<Budget>>): void {
    Object.assign(this, payload);
  }
}
