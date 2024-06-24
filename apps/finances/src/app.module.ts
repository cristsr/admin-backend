import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import {
  EntityConstraint,
  ExceptionFilter,
  ResponseInterceptor,
  validatorFactory,
} from '@shared';
import { AccountModule } from 'app/account/account.module';
import { BudgetModule } from 'app/budget/budget.module';
import { CategoryModule } from 'app/category/category.module';
import { AppController } from 'app/config/controllers';
import { DatabaseModule } from 'app/config/database/';
import { Environment } from 'app/config/env';
import { MovementModule } from 'app/movement/movement.module';
import { ScheduledModule } from 'app/scheduled/scheduled.module';
import { SubcategoryModule } from 'app/subcategory/subcategory.module';
import { SummaryModule } from 'app/summary/summary.module';

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
    EntityConstraint,
  ],
})
export class AppModule {}
