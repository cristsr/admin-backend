import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenerateBudgets } from '../../../application/budget.constants';

@Injectable()
export class BudgetScheduler {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  createBudgets() {
    this.eventEmitter.emit(GenerateBudgets);
  }
}
