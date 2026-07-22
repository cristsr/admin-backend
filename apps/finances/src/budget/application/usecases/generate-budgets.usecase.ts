import { Injectable, Logger, Optional } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Budget, BudgetReports, BudgetRepository } from '@app/budget/domain/budget';
import { correlationId, withSpan } from '@app/config/telemetry/correlation';

/** Regenerates repeating budgets whose period has closed, logging per-run counters. */
@Injectable()
export class GenerateBudgetsUsecase {
  private readonly logger: Logger;

  constructor(
    private readonly budgetRepository: BudgetRepository,
    @Optional() logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(GenerateBudgetsUsecase.name);
  }

  async execute(): Promise<void> {
    return withSpan('budgets.generate', async () => {
      const runId = correlationId();
      this.logger.log(`budgetsCronStart correlationId=${runId}`);

      const utc = DateTime.utc();
      const budgets = await this.budgetRepository.matching(BudgetReports.dueForRegeneration(utc.toJSDate()));

      let generated = 0;
      for (const budget of budgets) {
        const isRenewed = await this.renew(budget, utc);
        if (isRenewed) generated += 1;
      }

      this.logger.log(`budgetsCronDone budgetsGenerated=${generated} correlationId=${runId}`);
    });
  }

  /**
   * The expired budget is only deactivated once its successor exists, so a
   * failed save leaves the current one running for the next run to retry.
   */
  private async renew(budget: Budget, now: DateTime): Promise<boolean> {
    try {
      await this.budgetRepository.save(budget.renew(now));
    } catch (error) {
      this.logger.error(`Error creating budget ${budget.id}: ${error.message}`, error.stack);
      return false;
    }

    await this.budgetRepository.deactivate(budget.id);

    return true;
  }
}
