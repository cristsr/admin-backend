import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { validatorFactory } from '@shared';
import { AppController } from 'app/config/controllers';
import { DatabaseModule } from 'app/database/';
import { Environment } from 'app/env';
import { AccountModule } from 'app/modules/account/account.module';
import { BudgetModule } from 'app/modules/budget/budget.module';
import { CategoryModule } from 'app/modules/category/category.module';
import { MovementModule } from 'app/modules/movement/movement.module';
import { ScheduledModule } from 'app/modules/scheduled/scheduled.module';
import { SubcategoryModule } from 'app/modules/subcategory/subcategory.module';
import { SummaryModule } from 'app/modules/summary/summary.module';
import { AuthGuard } from './auth/guards';

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
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
