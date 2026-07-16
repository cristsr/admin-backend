import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Budget, BudgetRepository, Period } from '../../domain/budget';

@Injectable()
export class GenerateBudgetsUsecase {
  #logger = new Logger(GenerateBudgetsUsecase.name);

  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(): Promise<void> {
    this.#logger.log('Generating budgets');

    const utc = DateTime.utc();
    const budgets = await this.budgetRepository.findDueForRegeneration(
      utc.toJSDate(),
    );

    for (const budget of budgets) {
      const { startDate, endDate } = this.nextPeriodDates(budget, utc);

      const next = Budget.create({
        name: budget.name,
        amount: budget.amount,
        currency: budget.currency,
        categoryId: budget.categoryId,
        accountId: budget.accountId,
        repeat: budget.repeat,
        period: budget.period,
        user: budget.user,
        startDate,
        endDate,
      } as Budget);

      await this.budgetRepository.save(next).catch((error) => {
        this.#logger.error(`Error creating budget ${error.message}`);
      });

      await this.budgetRepository.deactivate(budget.id);
    }

    this.#logger.log('Budgets generated');
  }

  private nextPeriodDates(
    budget: Budget,
    utc: DateTime,
  ): { startDate: Date; endDate: Date } {
    switch (budget.period) {
      case Period.DAILY:
        return {
          startDate: utc.startOf('day').toJSDate(),
          endDate: utc.endOf('day').toJSDate(),
        };

      case Period.WEEKLY:
      case Period.CUSTOM: {
        const startDate = DateTime.fromJSDate(budget.startDate);
        const endDate = DateTime.fromJSDate(budget.endDate);

        return {
          startDate: utc.startOf('day').toJSDate(),
          endDate: utc
            .plus({ days: startDate.diff(endDate).days })
            .endOf('day')
            .toJSDate(),
        };
      }

      case Period.MONTHLY:
        return {
          startDate: utc.startOf('month').toJSDate(),
          endDate: utc.endOf('month').toJSDate(),
        };

      case Period.YEARLY:
        return {
          startDate: utc.startOf('year').toJSDate(),
          endDate: utc.endOf('year').toJSDate(),
        };
    }
  }
}
