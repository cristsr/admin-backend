import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '../../../shared-kernel/application/query/query-bus';
import { CurrentUser } from '../../../shared/application/decorators/current-user.decorator';
import { LedgerContext } from '../../../shared/domain/ledger-context';
import { AuthGuard } from '../../../shared/infrastructure/guards/auth.guard';
import { GetNetWorthQuery } from '../../application/queries/get-net-worth.query';
import { ListExpensesQuery } from '../../application/queries/list-expenses.query';
import { NetWorthOutputDto } from '../../application/dto/net-worth-output.dto';
import { ExpenseReportDto } from '../../application/dto/expense-report.dto';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('net-worth')
  async getNetWorth(
    @CurrentUser() context: LedgerContext,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<NetWorthOutputDto> {
    return this.queryBus.ask(new GetNetWorthQuery(context.userId, asOfDate));
  }

  @Get('expenses')
  async listExpenses(
    @CurrentUser() context: LedgerContext,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<ExpenseReportDto> {
    return this.queryBus.ask(new ListExpensesQuery(context.userId, startDate, endDate));
  }
}
