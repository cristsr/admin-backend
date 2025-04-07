// nest module
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validatorFactory } from '@shared';
import { DatabaseModule } from 'app/config/database';
import { Environment } from 'app/env';
import { ExchangeModule } from 'app/modules/exchange/exchange.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(Environment),
    }),
    DatabaseModule,
    ExchangeModule,
  ],
})
export class AppModule {}
