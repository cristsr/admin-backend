import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { configValidator } from '@admin-back/utils';
import { AppController } from './app.controller';
import { Environment } from 'env';
import { AuthgraphModule } from 'domain/auth2/authgraph.module';
import { AuthModule } from 'app/auth';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter, RpcFilter } from 'core/filters';

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
    AuthgraphModule,
  ],
  providers: [
    // {
    //   provide: APP_FILTER,
    //   useClass: RpcFilter,
    // },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  controllers: [AppController],
})
export class MainModule {}
