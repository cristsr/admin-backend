import { Controller, Get, Query } from '@nestjs/common';
import {
  BalanceFilterDto,
  ExpenseFilterDto,
  LastMovementFilterDto,
} from '../../../application/dto';
import {
  GetBalanceUsecase,
  GetExpensesUsecase,
  GetLastMovementsUsecase,
} from '../../../application/usecases';

@Controller('summary')
export class SummaryController {
  constructor(
    private readonly getBalanceUsecase: GetBalanceUsecase,
    private readonly getExpensesUsecase: GetExpensesUsecase,
    private readonly getLastMovementsUsecase: GetLastMovementsUsecase,
  ) {}

  @Get('balance')
  balance(@Query() filter: BalanceFilterDto) {
    return this.getBalanceUsecase.execute(filter);
  }

  @Get('expenses')
  expenses(@Query() filter: ExpenseFilterDto) {
    return this.getExpensesUsecase.execute(filter);
  }

  @Get('last-movements')
  lastMovements(@Query() filter: LastMovementFilterDto) {
    return this.getLastMovementsUsecase.execute(filter);
  }
}
