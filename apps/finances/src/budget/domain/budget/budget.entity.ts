import { PropertiesOnly } from '@shared';
import { BudgetThreshold } from './budget-threshold.enum';
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

  /**
   * Highest threshold already notified in the current period. `null`/undefined
   * = none notified yet. When a repeatable budget renews, the new one starts
   * clean (AC-1).
   */
  notifiedThreshold?: BudgetThreshold;

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
