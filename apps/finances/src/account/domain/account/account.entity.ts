import { PropertiesOnly } from '@shared';
import { Money } from '@app/shared/domain';
import { InsufficientBalanceException } from './account.exception';

export class Account {
  id: number;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  /** What the account held before any movement was recorded against it. */
  initialBalance: Money;

  /**
   * AC-1 (sm-0003) — per-account policy for negative balance. When true (e.g. a
   * credit card), withdrawals that would leave the account negative are allowed.
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

  /** The currency every amount on this account is expressed in. */
  currencyCode(): string {
    return this.initialBalance.currency;
  }

  /**
   * What the account actually holds right now: what it started with plus the
   * signed sum of its movements. That sum is a scalar coming straight from the
   * database — the account is what knows which currency it belongs to.
   */
  liveBalance(movementBalance: number): Money {
    return this.initialBalance.add(
      Money.of(movementBalance, this.currencyCode()),
    );
  }

  /**
   * Refuses a withdrawal the account cannot fund (AC-1). An account that allows
   * a negative balance — a credit card, say — funds anything; the rest have to
   * cover the amount with what they currently hold.
   */
  ensureCanWithdraw(amount: Money, movementBalance: number): void {
    if (this.allowNegativeBalance) return;

    if (!this.liveBalance(movementBalance).subtract(amount).isNegative()) return;

    throw new InsufficientBalanceException(
      `Account ${this.id} has insufficient balance to withdraw ${amount}`,
    );
  }
}
