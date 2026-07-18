import { Module } from '@nestjs/common';
import { ExchangeRateProvider } from './domain';
import { HttpExchangeRateProvider } from './infrastructure/http-exchange-rate.provider';

/**
 * Provee el puerto `ExchangeRateProvider` para transferencias cross-currency y
 * balance consolidado (AC-2). Lo importan TransferModule y SummaryModule.
 */
@Module({
  providers: [
    { provide: ExchangeRateProvider, useClass: HttpExchangeRateProvider },
  ],
  exports: [ExchangeRateProvider],
})
export class ExchangeModule {}
