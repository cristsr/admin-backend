import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenerateBudgets } from '@app/budget/application/budget.constants';

@Injectable()
export class BudgetScheduler {
  private readonly logger = new Logger(BudgetScheduler.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  createBudgets() {
    this.logger.log('budgetsCronFired');
    this.eventEmitter.emit(GenerateBudgets);
  }
}
