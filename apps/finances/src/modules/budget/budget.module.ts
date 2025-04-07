import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from 'app/modules/account/account.module';
import { BudgetController } from 'app/modules/budget/controllers';
import { BudgetEntity } from 'app/modules/budget/entities';
import { BudgetRepository } from 'app/modules/budget/repositories';
import { BudgetSchedule } from 'app/modules/budget/schedulers';
import { BudgetService } from 'app/modules/budget/services';
import { CategoryModule } from 'app/modules/category/category.module';
import { MovementModule } from 'app/modules/movement/movement.module';

const Entities = TypeOrmModule.forFeature([BudgetEntity]);
const Repositories = [BudgetRepository];

@Module({
  imports: [Entities, CategoryModule, MovementModule, AccountModule],
  controllers: [BudgetController],
  providers: [...Repositories, BudgetService, BudgetSchedule],
  exports: [...Repositories],
})
export class BudgetModule {}
