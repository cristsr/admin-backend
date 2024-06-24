import { ApolloDriver } from '@nestjs/apollo';
import { CacheModule } from '@nestjs/cache-manager';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import {
  DateScalar,
  EntityConstraint,
  GRPCInterceptor,
  RequestInterceptor,
  RpcExceptionFilter,
  validatorFactory,
} from '@shared';
import { AuthModule } from 'app/auth';
import { Environment } from 'app/config/env';
import { FinancesModule } from 'app/finances';
import { UsersModule } from 'app/users';
import { AppController } from './config/controllers';

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
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: 'MODULE',
      useClass: MainModule,
    },
    DateScalar,
    GRPCInterceptor,
    EntityConstraint,
  ],
  controllers: [AppController],
})
export class MainModule {}
