import { Controller, Get, Query } from '@nestjs/common';
import {
  Balance,
  BalanceFilter,
  Expense,
  ExpenseFilter,
  LastMovementFilter,
} from '@core';
import { Observable } from 'rxjs';
import { SummaryService } from 'app/modules/summary/services';

@Controller('summary')
export class SummaryController {
  constructor(private summaryService: SummaryService) {}

  @Get('balance')
  balance(@Query() filter: BalanceFilter): Observable<Balance> {
    return this.summaryService.balance(filter);
  }

  @Get('expenses')
  expenses(@Query() filter: ExpenseFilter): Observable<Expense[]> {
    return this.summaryService.expenses(filter);
  }

  @Get('last-movements')
  lastMovements(@Query() filter: LastMovementFilter) {
    return this.summaryService.lastMovements(filter);
  }
}
