import { ApolloDriver } from '@nestjs/apollo';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { Environment } from 'env';
import {
  DateScalar,
  GRPCInterceptor,
  RequestInterceptor,
  RpcExceptionFilter,
  validatorFactory,
} from '@admin-back/shared';
import { AuthModule } from 'app/auth';
import { FinancesModule } from 'app/finances';
import { UsersModule } from 'app/users';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(Environment),
    }),
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
      debug: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    AuthModule,
    FinancesModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: RpcExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestInterceptor,
    },
    DateScalar,
    GRPCInterceptor,
  ],
  controllers: [AppController],
})
export class MainModule {}
