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

/**
 * Exchange rates for cross-currency transfers and consolidated balance (AC-2).
 * Exposes the `ExchangeRateProvider` port (consumed by TransferModule and
 * SummaryModule) backed by the in-process exchange service, plus the public
 * `exchanges` HTTP endpoint.
 */
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
