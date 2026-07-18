import { Controller, Get, Query } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '@shared';
import {
  ConsolidatedBalanceFilterDto,
  ExpenseFilterDto,
  LastMovementFilterDto,
} from '../../../application/dto';
import {
  GetConsolidatedBalanceUsecase,
  GetExpensesUsecase,
  GetLastMovementsUsecase,
} from '../../../application/usecases';

@Controller('summary')
export class SummaryController {
  constructor(
    private readonly getConsolidatedBalanceUsecase: GetConsolidatedBalanceUsecase,
    private readonly getExpensesUsecase: GetExpensesUsecase,
    private readonly getLastMovementsUsecase: GetLastMovementsUsecase,
  ) {}

  @Get('balance')
  balance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ConsolidatedBalanceFilterDto,
  ) {
    return this.getConsolidatedBalanceUsecase.execute(
      filter,
      user.id,
      user.presentationCurrency,
    );
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
