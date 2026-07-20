import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeController } from './controllers';
import { ExchangeRateProvider } from './domain';
import { ExchangeEntity } from './entities';
import { LocalExchangeRateProvider } from './infrastructure/local-exchange-rate.provider';
import { ExRatesService, ExchangeRatesService } from './providers';
import { ExchangeRepository } from './repositories';
import { AppService } from './services';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([ExchangeEntity])],
  controllers: [ExchangeController],
  providers: [
    {
      provide: ExchangeRatesService,
      useClass: ExRatesService,
    },
    ExchangeRepository,
    AppService,
    {
      provide: ExchangeRateProvider,
      useClass: LocalExchangeRateProvider,
    },
  ],
  exports: [ExchangeRateProvider],
})
export class ExchangeModule {}
