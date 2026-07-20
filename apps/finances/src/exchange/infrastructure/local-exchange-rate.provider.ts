import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import {
  ExchangeRateProvider,
  ExchangeRateUnavailableException,
} from '../domain';
import { AppService } from '../services/app.service';

/**
 * Resolves conversion rates against the in-process exchange service, replacing
 * the former HTTP client now that `exchanges` lives inside this monolith. An
 * amount of `1` is requested so the returned value is the bare rate.
 */
@Injectable()
export class LocalExchangeRateProvider implements ExchangeRateProvider {
  constructor(private readonly exchange: AppService) {}

  async getRate(from: string, to: string, date: Date): Promise<number> {
    try {
      // `rate: 1` acts as the amount multiplier, so the emitted rate is raw.
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
      // firstValueFrom throws EmptyError when the source completes without a
      // rate (unknown pair / scraper miss); surface it as the domain failure.
      throw new ExchangeRateUnavailableException(
        `Could not resolve rate ${from}->${to} at ${date.toISOString()}`,
        { cause: error as Error },
      );
    }
  }
}
