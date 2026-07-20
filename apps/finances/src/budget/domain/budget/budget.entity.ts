import { Nullable, PropertiesOnly } from '@shared';
import { DateTime } from 'luxon';
import { Money } from '@app/shared/domain';
import { BudgetThreshold } from './budget-threshold.enum';
import { Period } from './period.enum';

/** Percentage of the budget's amount at which each threshold fires. */
const THRESHOLD_LIMITS: Record<BudgetThreshold, number> = {
  [BudgetThreshold.WARNING]: 80,
  [BudgetThreshold.EXCEEDED]: 100,
};

/**
 * Severity order: a fired threshold blocks re-firing at the same or lower
 * rank, but a more severe one may still be reported.
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

  money: Money;

  startDate: Date;

  endDate: Date;

  repeat: boolean;

  period: Period;

  /** Highest threshold already notified in the current period. */
  notifiedThreshold?: BudgetThreshold;

  categoryId: number;

  accountId: number;

  user: number;

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
   * Registers what has been spent in the period and derives `percentage`;
   * both stay unset until this runs.
   */
  recordSpending(spent: Money): void {
    this.spent = spent;
    this.percentage = spent.percentageOf(this.money);
  }

  /**
   * Claims the threshold just crossed, if any, and marks it as notified.
   * Mutates the budget; the caller must persist it for "once per period" to hold.
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

  /** The budget for the following period, with a clean notification state. */
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
   * CUSTOM and WEEKLY keep their original span re-anchored to today; calendar
   * periods snap to the current day, month or year.
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
