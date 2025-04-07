import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeController } from 'app/modules/exchange/controllers';
import { ExchangeEntity } from 'app/modules/exchange/entities';
import {
  ExRatesService,
  ExchangeRatesService,
} from 'app/modules/exchange/providers';
import { ExchangeRepository } from 'app/modules/exchange/repositories';
import { AppService } from 'app/modules/exchange/services';

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
  ],
})
export class ExchangeModule {}
