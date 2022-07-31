import { CacheModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import {
  configValidator,
  AllExceptionFilter,
  RequestInterceptor,
} from '@admin-back/shared';
import { AppController } from './app.controller';
import { Environment } from 'env';
import { AuthModule } from 'app/auth';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: object) => configValidator(config, Environment),
    }),
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
      debug: true,
      playground: true,
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    AuthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestInterceptor,
    },
  ],
  controllers: [AppController],
})
export class MainModule {}
