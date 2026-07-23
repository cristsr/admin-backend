import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedKernelModule } from '../shared-kernel/shared-kernel.module';
import { CreateBudgetHandler } from './application/handlers/create-budget.handler';
import { CreateGoalHandler } from './application/handlers/create-goal.handler';
import { BudgetsProjector } from './infrastructure/projections/budgets.projector';
import { GoalsProjector } from './infrastructure/projections/goals.projector';

@Module({
  imports: [CqrsModule, SharedKernelModule],
  providers: [
    CreateBudgetHandler,
    CreateGoalHandler,
    BudgetsProjector,
    GoalsProjector,
  ],
})
export class ProductModule {}
