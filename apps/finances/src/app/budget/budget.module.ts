import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { AccountModule } from 'app/account/account.module';

import { BudgetService } from 'app/budget/services';
import { BudgetHandler } from 'app/budget/handlers';
import { BudgetEntity } from 'app/budget/entities';
import { BudgetSchedule } from 'app/budget/schedulers';

const Entities = TypeOrmModule.forFeature([BudgetEntity]);

@Module({
  controllers: [BudgetService],
  imports: [Entities, CategoryModule, MovementModule, AccountModule],
  providers: [BudgetHandler, BudgetSchedule],
  exports: [Entities],
})
export class BudgetModule {}
