import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BudgetService } from 'app/budget/services';
import { BudgetHandler } from 'app/budget/handlers';
import { BudgetEntity } from 'app/budget/entities';
import { BudgetSchedule } from 'app/budget/schedulers';
import { CategoryModule } from 'apps/finances/src/app/category/category.module';
import { MovementModule } from 'apps/finances/src/app/movement/movement.module';

const Entities = TypeOrmModule.forFeature([BudgetEntity]);

@Module({
  controllers: [BudgetService],
  imports: [
    Entities,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    CategoryModule,
    MovementModule,
  ],
  providers: [BudgetHandler, BudgetSchedule],
  exports: [Entities],
})
export class BudgetModule {}
