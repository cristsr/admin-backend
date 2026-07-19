import { PropertiesOnly } from '@shared';

export class Account {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  initialBalance: number;

  currency: string;

  /**
   * AC-1 (sm-0003) — per-account policy for negative balance. When true (e.g. a
   * credit card), transfers that would leave the account negative are allowed.
   */
  allowNegativeBalance: boolean;

  user: number;

  private constructor(payload?: Partial<Account>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<Account>): Account {
    return new Account(payload);
  }

  update(payload: Partial<PropertiesOnly<Account>>): void {
    Object.assign(this, payload);
  }
}
