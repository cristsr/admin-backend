import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule, ExceptionFilter, SubjectIdentityResolver } from '@shared';
import { LoggerModule } from 'nestjs-pino';
import { loadEnvironment } from '@app/env';
import { AccountModule } from './account/account.module';
import { BudgetModule } from './budget/budget.module';
import { CategorizationRuleModule } from './categorization-rule/categorization-rule.module';
import { CategoryModule } from './category/category.module';
import { AppController } from './config/controllers/app.controller';
import {
  AuthConfig,
  ThrottleConfig,
  appConfig,
  authConfig,
  databaseConfig,
  exchangeConfig,
  messagingConfig,
  throttleConfig,
  webhookConfig,
} from './config/environment';
import { buildPinoModuleOptions } from './config/logger/logger.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { MovementModule } from './movement/movement.module';
import { OutboxModule } from './outbox/outbox.module';
import { ScheduledModule } from './scheduled/scheduled.module';
import { SummaryModule } from './summary/summary.module';
import { TransferModule } from './transfer/transfer.module';
import { UserModule } from './user/user.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: 'apps/finances/.env',
      load: [
        appConfig,
        databaseConfig,
        authConfig,
        throttleConfig,
        exchangeConfig,
        webhookConfig,
        messagingConfig,
      ],
      validate: () => loadEnvironment(),
    }),
    LoggerModule.forRoot(buildPinoModuleOptions()),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({}),
    ThrottlerModule.forRootAsync({
      inject: [throttleConfig.KEY],
      useFactory: (throttle: ThrottleConfig) => throttle,
    }),
    DatabaseModule,
    AuthModule.forRootAsync({
      imports: [UserModule],
      inject: [authConfig.KEY],
      identityResolver: SubjectIdentityResolver,
      useFactory: (auth: AuthConfig) => ({
        issuer: auth.issuer,
        audience: auth.audience,
      }),
    }),
    HealthModule,
    AccountModule,
    CategoryModule,
    MovementModule,
    SummaryModule,
    BudgetModule,
    ScheduledModule,
    TransferModule,
    UserModule,
    WebhookModule,
    OutboxModule,
    IdempotencyModule,
    CategorizationRuleModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
