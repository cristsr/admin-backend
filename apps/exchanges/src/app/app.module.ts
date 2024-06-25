import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validatorFactory } from '@shared';
import { DatabaseModule } from 'config/database';
import { Environment } from 'config/env';
import { AppController } from 'app/cotrollers';
import { ExchangeEntity } from 'app/entities';
import { ExRatesService, ExchangeRatesService } from 'app/providers';
import { ExchangeRepository } from 'app/repositories';
import { AppService } from 'app/services';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validatorFactory(Environment),
    }),
    HttpModule,
    DatabaseModule,
    TypeOrmModule.forFeature([ExchangeEntity]),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: ExchangeRatesService,
      useClass: ExRatesService,
    },
    ExchangeRepository,
    AppService,
  ],
})
export class AppModule {}
