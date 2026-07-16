import { Controller, Get, Query } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
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
  balance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BalanceFilterDto,
  ) {
    return this.getBalanceUsecase.execute(filter, user.id);
  }

  @Get('expenses')
  expenses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ExpenseFilterDto,
  ) {
    return this.getExpensesUsecase.execute(filter, user.id);
  }

  @Get('last-movements')
  lastMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: LastMovementFilterDto,
  ) {
    return this.getLastMovementsUsecase.execute(filter, user.id);
  }
}
