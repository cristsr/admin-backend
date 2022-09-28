import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import {
  configValidator,
  ResponseInterceptor,
  TypeormFilter,
} from '@admin-back/shared';
import { Environment } from 'env';
import { DatabaseModule } from 'database/database.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { SummaryModule } from 'app/summary/summary.module';
import { BudgetModule } from 'app/budget/budget.module';
import { BillModule } from 'app/bill/bill.module';
import { ScheduledModule } from 'app/scheduled/scheduled.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';
import { AppController } from './app.controller';
import { AccountModule } from 'app/account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: object) => configValidator(config, Environment),
    }),
    CacheModule.register(),
    DatabaseModule,
    AccountModule,
    CategoryModule,
    SubcategoryModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
