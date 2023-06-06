import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { AccountModule } from 'app/account/account.module';
import { BudgetService } from 'app/budget/services';
import { BudgetEntity } from 'app/budget/entities';
import { BudgetSchedule } from 'app/budget/schedulers';
import { BudgetRepository } from 'app/budget/repositories';

const Entities = TypeOrmModule.forFeature([BudgetEntity]);
const Repositories = [BudgetRepository];

@Module({
  controllers: [BudgetService],
  imports: [Entities, CategoryModule, MovementModule, AccountModule],
  providers: [...Repositories, BudgetSchedule],
  exports: [...Repositories],
})
export class BudgetModule {}
