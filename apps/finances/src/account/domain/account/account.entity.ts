import { PropertiesOnly } from '@shared';

export class Account {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  initialBalance: number;

  currency: string;

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
