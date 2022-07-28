import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { configValidator } from '@admin-back/utils';
import { Environment } from 'env';
import { AppController } from './app.controller';
import { AuthModule } from 'domain/auth/auth.module';

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
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
