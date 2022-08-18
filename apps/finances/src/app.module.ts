import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { configValidator, TypeormFilter } from '@admin-back/shared';
import { Environment } from 'env';
import { DatabaseModule } from 'database/database.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { SummaryModule } from 'app/summary/summary.module';
import { BudgetModule } from 'app/budget/budget.module';
import { BillModule } from 'app/bill/bill.module';
import { ScheduledModule } from 'app/scheduled/scheduled.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: object) => configValidator(config, Environment),
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
