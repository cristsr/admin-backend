import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExchangeRatesInput } from '@app/exchange/dto';
import { AppService } from '../services/app.service';

@ApiTags('exchanges')
@ApiBearerAuth()
@Controller('exchanges')
export class ExchangeController {
  constructor(private appService: AppService) {}

  @Get('rate')
  rate(@Query() input: ExchangeRatesInput) {
    return this.appService.rate(input);
  }
}
