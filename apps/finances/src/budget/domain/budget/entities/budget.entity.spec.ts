import { DateTime } from 'luxon';
import { Money } from '@app/shared/domain';
import { BudgetThreshold } from '../enums/budget-threshold.enum';
import { Period } from '../enums/period.enum';
import { Budget } from './budget.entity';

const buildBudget = (overrides: Partial<Budget> = {}) =>
  Budget.create({
    id: 1,
    name: 'Groceries',
    money: Money.of(100, 'COP'),
    period: Period.MONTHLY,
    repeat: true,
    categoryId: 3,
    accountId: 2,
    user: 7,
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-31'),
    ...overrides,
  } as Budget);

describe('Budget', () => {
  describe('recordSpending', () => {
    it('derives the percentage from what has been spent', () => {
      const budget = buildBudget();
      budget.recordSpending(Money.of(80, 'COP'));

      expect(budget.spent?.amount).toBe(80);
      expect(budget.percentage).toBe(80);
    });
  });

  describe('claimThresholdBreach', () => {
    it('claims WARNING the first time 80% is crossed', () => {
      const budget = buildBudget();
      budget.recordSpending(Money.of(80, 'COP'));

      expect(budget.claimThresholdBreach()).toBe(BudgetThreshold.WARNING);
      expect(budget.notifiedThreshold).toBe(BudgetThreshold.WARNING);
    });

    it('claims nothing below the first threshold', () => {
      const budget = buildBudget();
      budget.recordSpending(Money.of(79.99, 'COP'));

      expect(budget.claimThresholdBreach()).toBeNull();
      expect(budget.notifiedThreshold).toBeUndefined();
    });

    it('claims nothing twice for the same threshold in the period', () => {
      const budget = buildBudget({
        notifiedThreshold: BudgetThreshold.WARNING,
      });
      budget.recordSpending(Money.of(85, 'COP'));

      expect(budget.claimThresholdBreach()).toBeNull();
    });

    it('still claims EXCEEDED after WARNING was already claimed', () => {
      const budget = buildBudget({
        notifiedThreshold: BudgetThreshold.WARNING,
      });
      budget.recordSpending(Money.of(120, 'COP'));

      expect(budget.claimThresholdBreach()).toBe(BudgetThreshold.EXCEEDED);
      expect(budget.notifiedThreshold).toBe(BudgetThreshold.EXCEEDED);
    });

    it('never falls back to a milder threshold once EXCEEDED was claimed', () => {
      const budget = buildBudget({
        notifiedThreshold: BudgetThreshold.EXCEEDED,
      });
      budget.recordSpending(Money.of(85, 'COP'));

      expect(budget.claimThresholdBreach()).toBeNull();
      expect(budget.notifiedThreshold).toBe(BudgetThreshold.EXCEEDED);
    });
  });

  describe('renew', () => {
    const now = DateTime.utc(2026, 8, 15);

    it('starts the successor with a clean notification state', () => {
      const budget = buildBudget({
        notifiedThreshold: BudgetThreshold.EXCEEDED,
      });

      expect(budget.renew(now).notifiedThreshold).toBeUndefined();
    });

    it('carries the cap, the category and the account over', () => {
      const next = buildBudget().renew(now);

      expect(next.money.amount).toBe(100);
      expect(next.categoryId).toBe(3);
      expect(next.accountId).toBe(2);
      expect(next.user).toBe(7);
    });

    it('snaps a monthly budget to the current month', () => {
      const next = buildBudget({ period: Period.MONTHLY }).renew(now);

      expect(DateTime.fromJSDate(next.startDate).toUTC().day).toBe(1);
      expect(DateTime.fromJSDate(next.endDate).toUTC().month).toBe(8);
    });

    it('snaps a yearly budget to the current year', () => {
      const next = buildBudget({ period: Period.YEARLY }).renew(now);

      expect(DateTime.fromJSDate(next.startDate).toUTC().month).toBe(1);
      expect(DateTime.fromJSDate(next.endDate).toUTC().month).toBe(12);
    });
  });
});
