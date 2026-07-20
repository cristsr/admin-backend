import { Injectable, Logger, Optional } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  Budget,
  BudgetCriteria,
  BudgetRepository,
} from '@app/budget/domain/budget';
import { correlationId, withSpan } from '@app/config/telemetry/correlation';

/**
 * AC-4 (sm-0004): logs a structured counters line per run, keyed by a per-run
 * correlation id, so the cron's work is measurable from the logs alone. There
 * is no `/metrics` endpoint in this story.
 */
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
    // The run gets its own span, so the id below is the trace id every log line
    // and every downstream call in this run already shares.
    return withSpan('budgets.generate', async () => {
      const runId = correlationId();
      this.logger.log(`budgetsCronStart correlationId=${runId}`);

      const utc = DateTime.utc();
      const budgets = await this.budgetRepository.matching(
        BudgetCriteria.dueForRegeneration(utc.toJSDate()),
      );

      let generated = 0;
      for (const budget of budgets) {
        const isRenewed = await this.renew(budget, utc);
        if (isRenewed) generated += 1;
      }

      this.logger.log(
        `budgetsCronDone budgetsGenerated=${generated} correlationId=${runId}`,
      );
    });
  }

  /**
   * The expired budget is only deactivated once its successor exists: failing
   * in between would leave the user with no budget at all, so a failed save
   * leaves the current one running and the next run retries it.
   */
  private async renew(budget: Budget, now: DateTime): Promise<boolean> {
    try {
      await this.budgetRepository.save(budget.renew(now));
    } catch (error) {
      this.logger.error(
        `Error creating budget ${budget.id}: ${error.message}`,
        error.stack,
      );
      return false;
    }

    await this.budgetRepository.deactivate(budget.id);

    return true;
  }
}
