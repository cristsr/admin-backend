import { CacheModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { Environment } from 'env';
import {
  DateScalar,
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
  ],
  controllers: [AppController],
})
export class MainModule {}
