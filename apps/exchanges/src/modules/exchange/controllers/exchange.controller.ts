import { Controller, Get, Query } from '@nestjs/common';
import { ExchangeRatesInput } from '@core';
import { AppService } from 'app/modules/exchange/services';

@Controller('exchanges')
export class ExchangeController {
  constructor(private appService: AppService) {}

  @Get('rate')
  rate(@Query() input: ExchangeRatesInput) {
    return this.appService.rate(input);
  }
}
