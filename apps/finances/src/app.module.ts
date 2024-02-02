import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from 'database/database.module';
import { Environment } from 'env';
import {
  ExceptionFilter,
  ResponseInterceptor,
  validatorFactory,
} from '@admin-back/shared';
import { AccountModule } from 'app/account/account.module';
import { BudgetModule } from 'app/budget/budget.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { ScheduledModule } from 'app/scheduled/scheduled.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';
import { SummaryModule } from 'app/summary/summary.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(Environment),
    }),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({}),
    DatabaseModule,
    AccountModule,
    CategoryModule,
    SubcategoryModule,
    MovementModule,
    SummaryModule,
    BudgetModule,
    ScheduledModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
