import { Injectable } from '@nestjs/common';
import { ExchangeRateProvider } from '@app/exchange/domain';
import { ExchangeRateInputDto } from '../dto/exchange-rate-input.dto';
import { ExchangeRateOutputDto } from '../dto/exchange-rate-output.dto';

/** Converts an amount between two currencies at a given date. */
@Injectable()
export class GetExchangeRateUsecase {
  constructor(private readonly exchangeRateProvider: ExchangeRateProvider) {}

  async execute(input: ExchangeRateInputDto): Promise<ExchangeRateOutputDto> {
    const rate = await this.exchangeRateProvider.getRate(input.from, input.to, input.date);

    return { rate: rate * input.rate };
  }
}
