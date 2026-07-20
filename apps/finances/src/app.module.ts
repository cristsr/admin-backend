import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  Auth0IdentityResolver,
  AuthModule,
  ExceptionFilter,
  validatorFactory,
} from '@shared';
import { LoggerModule } from 'nestjs-pino';
import { ENV, Environment } from '@app/env';
import { AccountModule } from './account/account.module';
import { BudgetModule } from './budget/budget.module';
import { CategorizationRuleModule } from './categorization-rule/categorization-rule.module';
import { CategoryModule } from './category/category.module';
import { AppController } from './config/controllers/app.controller';
import { buildPinoModuleOptions } from './config/logger/logger.config';
import { buildThrottlerOptions } from './config/throttler/throttler.config';
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
      validate: validatorFactory(Environment),
    }),
    LoggerModule.forRoot(buildPinoModuleOptions()),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({}),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildThrottlerOptions({
          THROTTLE_AUTH_TTL_MS: config.get<number>(ENV.THROTTLE_AUTH_TTL_MS),
          THROTTLE_AUTH_LIMIT: config.get<number>(ENV.THROTTLE_AUTH_LIMIT),
          THROTTLE_WEBHOOK_TTL_MS: config.get<number>(
            ENV.THROTTLE_WEBHOOK_TTL_MS,
          ),
          THROTTLE_WEBHOOK_LIMIT: config.get<number>(
            ENV.THROTTLE_WEBHOOK_LIMIT,
          ),
        }),
    }),
    DatabaseModule,
    AuthModule.forRootAsync({
      inject: [ConfigService],
      // The resolver class must be known at registration time, before DI runs.
      identityResolver:
        process.env.AUTH_IDENTITY_PROVIDER === 'auth0'
          ? Auth0IdentityResolver
          : undefined,
      useFactory: (configService: ConfigService) => ({
        issuer: configService.get(ENV.OIDC_ISSUER),
        audience: configService.get(ENV.OIDC_AUDIENCE),
        usersServiceUrl: configService.get(ENV.USERS_API_URL),
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
