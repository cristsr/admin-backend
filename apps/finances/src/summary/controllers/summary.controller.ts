import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  Balance,
  BalanceFilter,
  Expense,
  ExpenseFilter,
  LastMovementFilter,
  Movement,
  SUMMARY_HANDLER,
  SummaryHandler,
} from '@core';
import { Observable } from 'rxjs';
import { SummaryService } from 'app/summary/services';

@Controller()
export class SummaryController implements SummaryHandler {
  constructor(private summaryService: SummaryService) {}

  @GrpcMethod(SUMMARY_HANDLER)
  balance(filter: BalanceFilter): Observable<Balance> {
    return this.summaryService.balance(filter);
  }

  @GrpcMethod(SUMMARY_HANDLER)
  expenses(filter: ExpenseFilter): Observable<Expense[]> {
    return this.summaryService.expenses(filter);
  }

  @GrpcMethod(SUMMARY_HANDLER)
  lastMovements(filter: LastMovementFilter): Observable<Movement[]> {
    return this.summaryService.lastMovements(filter);
  }
}
