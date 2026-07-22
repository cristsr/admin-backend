import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExchangeRateInputDto, ExchangeRateOutputDto } from '@app/exchange/application/dto';
import { GetExchangeRateUsecase } from '@app/exchange/application/usecases';

@ApiTags('exchanges')
@ApiBearerAuth()
@Controller('exchanges')
export class ExchangeController {
  constructor(private readonly getExchangeRateUsecase: GetExchangeRateUsecase) {}

  @Get('rate')
  async rate(@Query() input: ExchangeRateInputDto): Promise<ExchangeRateOutputDto> {
    return this.getExchangeRateUsecase.execute(input);
  }
}
