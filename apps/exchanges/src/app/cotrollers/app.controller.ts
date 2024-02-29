import { Controller, Get, Query } from '@nestjs/common';
import { ExchangeRatesInput } from '@admin-back/grpc';
import { AppService } from 'app/services';

@Controller('exchanges')
export class AppController {
  constructor(private appService: AppService) {}

  @Get('rate')
  rate(@Query() input: ExchangeRatesInput) {
    return this.appService.rate(input);
  }
}
