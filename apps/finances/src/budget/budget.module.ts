import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from '../account/account.module';
import { CategoryModule } from '../category/category.module';
import { MovementModule } from '../movement/movement.module';
import {
  FindAllBudgetsUsecase,
  FindBudgetMovementsUsecase,
  FindBudgetUsecase,
  GenerateBudgetsUsecase,
  RemoveBudgetUsecase,
  SaveBudgetUsecase,
} from './application/usecases';
import {
  BudgetNotificationPublisher,
  BudgetRepository,
  BudgetSpendingService,
} from './domain/budget';
import {
  BudgetThresholdExceededEventHandler,
  GenerateBudgetsEventHandler,
  MovementSavedEventHandler,
} from './infrastructure/adapters/events';
import { BudgetController } from './infrastructure/adapters/http';
import { PgmqBudgetNotificationPublisher } from './infrastructure/adapters/messaging/pgmq-budget-notification.publisher';
import {
  TypeOrmBudgetEntity,
  TypeOrmBudgetRepository,
} from './infrastructure/adapters/persistence/typeorm/budget';
import { BudgetScheduler } from './infrastructure/adapters/schedulers';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmBudgetEntity]),
    CategoryModule,
    MovementModule,
    AccountModule,
  ],
  controllers: [BudgetController],
  providers: [
    { provide: BudgetRepository, useClass: TypeOrmBudgetRepository },
    BudgetSpendingService,
    FindBudgetUsecase,
    FindAllBudgetsUsecase,
    FindBudgetMovementsUsecase,
    SaveBudgetUsecase,
    RemoveBudgetUsecase,
    GenerateBudgetsUsecase,
    BudgetScheduler,
    GenerateBudgetsEventHandler,
    MovementSavedEventHandler,
    BudgetThresholdExceededEventHandler,
    {
      provide: BudgetNotificationPublisher,
      useClass: PgmqBudgetNotificationPublisher,
    },
  ],
  exports: [BudgetRepository],
})
export class BudgetModule {}
