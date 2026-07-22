import { PropertiesOnly } from '@shared';
import { Money } from '@app/shared/domain';
import { InsufficientBalanceException } from '../exceptions/account.exception';

export class Account {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  initialBalance: Money;

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

  currencyCode(): string {
    return this.initialBalance.currency;
  }

  /** Initial balance plus the signed movement sum, in the account's currency. */
  liveBalance(movementBalance: number): Money {
    return this.initialBalance.add(Money.of(movementBalance, this.currencyCode()));
  }

  /**
   * Refuses a withdrawal the account cannot fund; accounts that allow a
   * negative balance fund anything.
   */
  ensureCanWithdraw(amount: Money, movementBalance: number): void {
    if (this.allowNegativeBalance) return;

    if (!this.liveBalance(movementBalance).subtract(amount).isNegative()) return;

    throw new InsufficientBalanceException(
      `Account ${this.id} has insufficient balance to withdraw ${amount}`,
    );
  }
}
