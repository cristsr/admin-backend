import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from 'app/account/account.module';
import { BudgetController } from 'app/budget/controllers';
import { BudgetEntity } from 'app/budget/entities';
import { BudgetRepository } from 'app/budget/repositories';
import { BudgetSchedule } from 'app/budget/schedulers';
import { BudgetService } from 'app/budget/services';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';

const Entities = TypeOrmModule.forFeature([BudgetEntity]);
const Repositories = [BudgetRepository];

@Module({
  imports: [Entities, CategoryModule, MovementModule, AccountModule],
  controllers: [BudgetController],
  providers: [...Repositories, BudgetService, BudgetSchedule],
  exports: [...Repositories],
})
export class BudgetModule {}
