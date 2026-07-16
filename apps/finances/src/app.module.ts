import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Auth0IdentityResolver, AuthModule, validatorFactory } from '@shared';
import { AppController } from 'app/config/controllers';
import { DatabaseModule } from 'app/database/';
import { ENV, Environment } from 'app/env';
import { AccountModule } from 'app/modules/account/account.module';
import { BudgetModule } from 'app/modules/budget/budget.module';
import { CategoryModule } from 'app/modules/category/category.module';
import { MovementModule } from 'app/modules/movement/movement.module';
import { ScheduledModule } from 'app/modules/scheduled/scheduled.module';
import { SubcategoryModule } from 'app/modules/subcategory/subcategory.module';
import { SummaryModule } from 'app/modules/summary/summary.module';

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
    SubcategoryModule,
    MovementModule,
    SummaryModule,
    BudgetModule,
    ScheduledModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
