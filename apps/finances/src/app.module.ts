import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Auth0IdentityResolver, AuthModule, validatorFactory } from '@shared';
import { AppController } from 'app/config/controllers';
import { DatabaseModule } from 'app/database/';
import { ENV, Environment } from 'app/env';
import { AccountModule } from 'app/account/account.module';
import { BudgetModule } from 'app/budget/budget.module';
import { CategoryModule } from 'app/category/category.module';
import { MovementModule } from 'app/movement/movement.module';
import { ScheduledModule } from 'app/scheduled/scheduled.module';
import { SummaryModule } from 'app/summary/summary.module';
import { WebhookModule } from 'app/webhook/webhook.module';

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
    AuthModule.forRootAsync({
      inject: [ConfigService],
      // Selected here (not inside useFactory) because the resolver class
      // must be known at module-registration time, before DI runs.
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
    AccountModule,
    CategoryModule,
    MovementModule,
    SummaryModule,
    BudgetModule,
    ScheduledModule,
    WebhookModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
