import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import {
  ExchangeRateProvider,
  ExchangeRateUnavailableException,
} from '../domain';
import { AppService } from '../services/app.service';

/**
 * Resolves rates against the in-process exchange service; an amount of `1`
 * is requested so the returned value is the bare rate.
 */
@Injectable()
export class LocalExchangeRateProvider implements ExchangeRateProvider {
  constructor(private readonly exchange: AppService) {}

  async getRate(from: string, to: string, date: Date): Promise<number> {
    try {
      const { rate } = await firstValueFrom(
        this.exchange.rate({ from, to, date, rate: 1 }),
      );
      if (rate == null || Number.isNaN(rate)) {
        throw new ExchangeRateUnavailableException(
          `No rate for ${from}->${to} at ${date.toISOString()}`,
        );
      }
      return Number(rate);
    } catch (error) {
      if (error instanceof ExchangeRateUnavailableException) throw error;
      // firstValueFrom throws EmptyError on a miss; surface it as the domain failure.
      throw new ExchangeRateUnavailableException(
        `Could not resolve rate ${from}->${to} at ${date.toISOString()}`,
        { cause: error as Error },
      );
    }
  }
}
