import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetExchangeRateUsecase } from './application/usecases';
import { ExchangeRateProvider, ExchangeRateRepository, ExchangeRateSource } from './domain';
import { ExchangeController } from './infrastructure/adapters/http';
import {
  TypeOrmExchangeRateEntity,
  TypeOrmExchangeRateRepository,
} from './infrastructure/adapters/persistence/typeorm/exchange-rate';
import { CachingExchangeRateProvider, CuexExchangeRateSource } from './infrastructure/adapters/rates';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([TypeOrmExchangeRateEntity])],
  controllers: [ExchangeController],
  providers: [
    { provide: ExchangeRateRepository, useClass: TypeOrmExchangeRateRepository },
    { provide: ExchangeRateSource, useClass: CuexExchangeRateSource },
    { provide: ExchangeRateProvider, useClass: CachingExchangeRateProvider },
    GetExchangeRateUsecase,
  ],
  exports: [ExchangeRateProvider],
})
export class ExchangeModule {}
