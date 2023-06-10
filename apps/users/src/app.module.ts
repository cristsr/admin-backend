import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  configValidator,
  ExceptionFilter,
  ResponseInterceptor,
} from '@admin-back/shared';
import { UserEnvironment } from 'env';
import { DatabaseModule } from 'database/database.module';
import { UserModule } from 'app/user.module';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

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
