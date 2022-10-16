import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetService } from 'app/budget/services';
import { BudgetHandler } from 'app/budget/handlers';
import { BudgetEntity } from 'app/budget/entities';
import { BudgetSchedule } from 'app/budget/schedulers';
import { CategoryModule } from 'apps/finances/src/app/category/category.module';
import { MovementModule } from 'apps/finances/src/app/movement/movement.module';

const Entities = TypeOrmModule.forFeature([BudgetEntity]);

@Module({
  controllers: [BudgetService],
  imports: [Entities, CategoryModule, MovementModule],
  providers: [BudgetHandler, BudgetSchedule],
  exports: [Entities],
})
export class BudgetModule {}
