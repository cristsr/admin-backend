import { Controller, Get } from '@nestjs/common';
import { SummaryHandler } from 'app/summary/handler';
import { ClientDate } from 'core/decorators';
import { DateTime } from 'luxon';

@Controller({
  path: 'summary',
  version: '1',
})
export class SummaryController {
  constructor(private readonly summaryService: SummaryHandler) {}

  @Get('balance')
  balance() {
    return this.summaryService.balance();
  }

  @Get('expenses')
  expenses(@ClientDate() date: DateTime) {
    return this.summaryService.expenses(date);
  }

  @Get('last-movements')
  lastMovements() {
    return this.summaryService.lastMovements();
  }
}
