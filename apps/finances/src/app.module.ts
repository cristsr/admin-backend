import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from 'apps/finances/src/database/database.module';
import { validate } from 'apps/finances/src/env/utils';
import { AppController } from './app.controller';
import { CategoryModule } from 'apps/finances/src/app/category/category.module';
import { MovementModule } from 'apps/finances/src/app/movement/movement.module';
import { SummaryModule } from 'apps/finances/src/app/summary/summary.module';
import { BudgetModule } from 'apps/finances/src/app/budget/budget.module';
import { BillModule } from 'apps/finances/src/app/bill/bill.module';
import { ScheduledModule } from 'apps/finances/src/app/scheduled/scheduled.module';
import { APP_FILTER } from '@nestjs/core';
import { TypeormFilter } from 'apps/finances/src/core/filters';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validate,
    }),
    CacheModule.register(),
    DatabaseModule,
    CategoryModule,
    MovementModule,
    SummaryModule,
    BudgetModule,
    BillModule,
    ScheduledModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: TypeormFilter,
    },
  ],
})
export class AppModule {}
