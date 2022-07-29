import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { configValidator } from '@admin-back/utils';
import { Environment } from 'env';
import { DatabaseModule } from 'database/database.module';
import { AuthModule } from 'auth/auth.module';
import { AllExceptionsFilter, RpcFilter, TypeormFilter } from 'core/filters';
import { RequestInterceptor } from 'core/interceptors';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: object) => configValidator(config, Environment),
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: TypeormFilter,
    },
    // {
    //   provide: APP_FILTER,
    //   useClass: RpcFilter,
    // },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestInterceptor,
    },
  ],
})
export class AppModule {}
