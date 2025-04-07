import { ApolloDriver } from '@nestjs/apollo';
import { CacheModule } from '@nestjs/cache-manager';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { DateScalar, EntityConstraint, validatorFactory } from '@shared';
import { AuthModule } from 'app/auth';
import { Environment } from 'app/env';
import { FinancesModule } from 'app/modules/finances';
import { UsersModule } from 'app/modules/users';
import { AppController } from './modules/config/controllers';

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
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        forbidUnknownValues: false,
      }),
    },
    DateScalar,
    EntityConstraint,
  ],
  controllers: [AppController],
})
export class AppModule {}
