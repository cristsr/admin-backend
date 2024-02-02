import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from 'database/database.module';
import { UserEnvironment } from 'env';
import {
  ExceptionFilter,
  ResponseInterceptor,
  configValidator,
} from '@admin-back/shared';
import { UserModule } from 'app/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: object) => configValidator(config, UserEnvironment),
    }),
    DatabaseModule,
    UserModule,
  ],
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
