import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedKernelModule } from '../shared-kernel/shared-kernel.module';
import { RegisterCurrencyHandler } from './application/handlers/register-currency.handler';
import { RecordPriceHandler } from './application/handlers/record-price.handler';
import { ListCurrenciesHandler } from './application/handlers/list-currencies.handler';
import { ResolvePriceHandler } from './application/handlers/resolve-price.handler';
import { CurrenciesProjector } from './infrastructure/projections/currencies.projector';
import { PricesProjector } from './infrastructure/projections/prices.projector';
import { CurrenciesController } from './infrastructure/adapters/http/currencies.controller';
import { PricesController } from './infrastructure/adapters/http/prices.controller';

@Module({
  imports: [CqrsModule, SharedKernelModule],
  providers: [
    RegisterCurrencyHandler,
    RecordPriceHandler,
    ListCurrenciesHandler,
    ResolvePriceHandler,
    CurrenciesProjector,
    PricesProjector,
  ],
  controllers: [CurrenciesController, PricesController],
})
export class ReferenceModule {}
