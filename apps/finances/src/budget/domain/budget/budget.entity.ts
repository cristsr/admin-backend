import { Nullable, PropertiesOnly } from '@shared';
import { DateTime } from 'luxon';
import { Money } from '@app/shared/domain';
import { BudgetThreshold } from './budget-threshold.enum';
import { Period } from './period.enum';

/**
 * Percentage of the budget's amount at which each threshold fires.
 */
const THRESHOLD_LIMITS: Record<BudgetThreshold, number> = {
  [BudgetThreshold.WARNING]: 80,
  [BudgetThreshold.EXCEEDED]: 100,
};

/**
 * Severity order of the thresholds. A budget that already warned must not warn
 * again, but it must still be able to report that it went on to be exceeded.
 */
const THRESHOLD_RANK: Record<BudgetThreshold, number> = {
  [BudgetThreshold.WARNING]: 1,
  [BudgetThreshold.EXCEEDED]: 2,
};

/** Most severe first, so the first limit reached is the one that is reported. */
const THRESHOLDS_BY_SEVERITY = [
  BudgetThreshold.EXCEEDED,
  BudgetThreshold.WARNING,
];

export class Budget {
  id: number;

  active: boolean;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;

  name: string;

  /** The cap for the period, in the currency the budget is expressed in. */
  money: Money;

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

  /** Spent so far in the period. Only populated once {@link recordSpending} runs. */
  spent?: Money;

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

  /**
   * Registers how much has been spent against this budget in its period, which
   * is what `percentage` is derived from. Reading either without calling this
   * first only ever reports the budget as untouched.
   */
  recordSpending(spent: Money): void {
    this.spent = spent;
    this.percentage = spent.percentageOf(this.money);
  }

  /**
   * Claims the threshold this budget has just crossed, if any, and marks it as
   * notified so a later movement in the same period cannot re-announce it
   * (AC-1). Returns `null` when nothing new was crossed — including the case
   * where a more severe threshold was already claimed.
   *
   * Claiming mutates the budget, so the caller is expected to persist it; the
   * "once per period" guarantee lives in that saved state.
   */
  claimThresholdBreach(): Nullable<BudgetThreshold> {
    const reached = THRESHOLDS_BY_SEVERITY.find(
      (candidate) => this.percentage >= THRESHOLD_LIMITS[candidate],
    );

    if (!reached) return null;

    const notifiedRank = this.notifiedThreshold
      ? THRESHOLD_RANK[this.notifiedThreshold]
      : 0;

    if (THRESHOLD_RANK[reached] <= notifiedRank) return null;

    this.notifiedThreshold = reached;

    return reached;
  }

  /**
   * The budget for the period that follows the one ending now. The successor
   * starts with a clean notification state (AC-1): crossing 80% last month
   * says nothing about this month.
   */
  renew(now: DateTime): Budget {
    const { startDate, endDate } = this.nextPeriodDates(now);

    return Budget.create({
      name: this.name,
      money: this.money,
      categoryId: this.categoryId,
      accountId: this.accountId,
      repeat: this.repeat,
      period: this.period,
      user: this.user,
      startDate,
      endDate,
    } as Budget);
  }

  /**
   * A CUSTOM (or weekly) period keeps its original span and is re-anchored to
   * today; the calendar periods simply snap to the current day, month or year.
   */
  private nextPeriodDates(now: DateTime): { startDate: Date; endDate: Date } {
    switch (this.period) {
      case Period.DAILY:
        return {
          startDate: now.startOf('day').toJSDate(),
          endDate: now.endOf('day').toJSDate(),
        };

      case Period.WEEKLY:
      case Period.CUSTOM: {
        const startDate = DateTime.fromJSDate(this.startDate);
        const endDate = DateTime.fromJSDate(this.endDate);

        return {
          startDate: now.startOf('day').toJSDate(),
          endDate: now
            .plus({ days: startDate.diff(endDate).days })
            .endOf('day')
            .toJSDate(),
        };
      }

      case Period.MONTHLY:
        return {
          startDate: now.startOf('month').toJSDate(),
          endDate: now.endOf('month').toJSDate(),
        };

      case Period.YEARLY:
        return {
          startDate: now.startOf('year').toJSDate(),
          endDate: now.endOf('year').toJSDate(),
        };
    }
  }
}
