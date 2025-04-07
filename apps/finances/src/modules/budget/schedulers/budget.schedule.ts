import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenerateBudgets } from '@core';

@Injectable()
export class BudgetSchedule {
  constructor(private eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  createBudgets() {
    this.eventEmitter.emit(GenerateBudgets);
  }
}
