import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedKernelModule } from '../shared-kernel/shared-kernel.module';
import { ValuationService } from './domain/valuation/services/valuation.service';
import { GetNetWorthHandler } from './application/handlers/get-net-worth.handler';
import { ListExpensesHandler } from './application/handlers/list-expenses.handler';
import { ReportsController } from './infrastructure/adapters/http/reports.controller';

@Module({
  imports: [CqrsModule, SharedKernelModule],
  providers: [ValuationService, GetNetWorthHandler, ListExpensesHandler],
  controllers: [ReportsController],
})
export class ReportingModule {}
